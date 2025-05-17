// API module for handling data operations

const api = {
  // Initialize Supabase client
  client: null,
  
  // Initialize API
  initialize() {
    try {
      this.client = window.supabase.createClient(
        CONFIG.SUPABASE.URL,
        CONFIG.SUPABASE.KEY,
        {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
          },
          realtime: {
            params: {
              eventsPerSecond: 10
            }
          }
        }
      );
      
      return true;
    } catch (error) {
      console.error('Error initializing API:', error);
      return false;
    }
  },
  
  // Issues API
  issues: {
    // Get all issues
    async getAll({ bounds, type, page = 1, perPage = 10 } = {}) {
      try {
        let query = api.client
          .from('issues')
          .select('*, profiles(username)', { count: 'exact' });
        
        // Add location filters if bounds provided
        if (bounds) {
          const [sw, ne] = bounds;
          query = query
            .gte('latitude', sw[1])
            .lte('latitude', ne[1])
            .gte('longitude', sw[0])
            .lte('longitude', ne[0]);
        }
        
        // Add location type filter
        if (type && type !== 'global') {
          query = query.eq('location_type', type);
        }
        
        // Add pagination
        const from = (page - 1) * perPage;
        query = query
          .range(from, from + perPage - 1)
          .order('created_at', { ascending: false });
        
        const { data: issues, count, error } = await query;
        
        if (error) throw error;
        
        return {
          issues: issues || [],
          total: count || 0
        };
      } catch (error) {
        console.error('Error getting issues:', error);
        throw error;
      }
    },
    
    // Get single issue
    async get(id) {
      try {
        const { data: issue, error } = await api.client
          .from('issues')
          .select('*, profiles(username)')
          .eq('id', id)
          .single();
        
        if (error) throw error;
        
        return issue;
      } catch (error) {
        console.error('Error getting issue:', error);
        throw error;
      }
    },
    
    // Create issue
    async create({ title, description, category, latitude, longitude, location_name }) {
      try {
        const { data: issue, error } = await api.client
          .from('issues')
          .insert([{
            title,
            description,
            category,
            latitude,
            longitude,
            location_name,
            user_id: api.client.auth.user()?.id
          }])
          .select()
          .single();
        
        if (error) throw error;
        
        return issue;
      } catch (error) {
        console.error('Error creating issue:', error);
        throw error;
      }
    },
    
    // Update issue
    async update(id, updates) {
      try {
        const { data: issue, error } = await api.client
          .from('issues')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw error;
        
        return issue;
      } catch (error) {
        console.error('Error updating issue:', error);
        throw error;
      }
    },
    
    // Delete issue
    async delete(id) {
      try {
        const { error } = await api.client
          .from('issues')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        
        return true;
      } catch (error) {
        console.error('Error deleting issue:', error);
        throw error;
      }
    },
    
    // Subscribe to issue changes
    subscribe(callback) {
      return api.client
        .channel('issues')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'issues'
          },
          callback
        )
        .subscribe();
    }
  },
  
  // Locations API
  locations: {
    // Get location info from coordinates
    async getInfo([longitude, latitude], type = 'region') {
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?` +
          new URLSearchParams({
            access_token: CONFIG.MAPBOX.TOKEN,
            types: type,
            limit: 1
          })
        );
        
        if (!response.ok) throw new Error('Geocoding request failed');
        
        const data = await response.json();
        return data.features[0];
      } catch (error) {
        console.error('Error getting location info:', error);
        throw error;
      }
    },
    
    // Search locations
    async search(query) {
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
          new URLSearchParams({
            access_token: CONFIG.MAPBOX.TOKEN,
            types: 'country,region,place',
            limit: 5
          })
        );
        
        if (!response.ok) throw new Error('Location search failed');
        
        const data = await response.json();
        return data.features;
      } catch (error) {
        console.error('Error searching locations:', error);
        throw error;
      }
    }
  },
  
  // Comments API
  comments: {
    // Get comments for an issue
    async getForIssue(issueId) {
      try {
        const { data: comments, error } = await api.client
          .from('comments')
          .select('*, profiles(username)')
          .eq('issue_id', issueId)
          .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        return comments || [];
      } catch (error) {
        console.error('Error getting comments:', error);
        throw error;
      }
    },
    
    // Add comment
    async add(issueId, content) {
      try {
        const { data: comment, error } = await api.client
          .from('comments')
          .insert([{
            issue_id: issueId,
            content,
            user_id: api.client.auth.user()?.id
          }])
          .select('*, profiles(username)')
          .single();
        
        if (error) throw error;
        
        return comment;
      } catch (error) {
        console.error('Error adding comment:', error);
        throw error;
      }
    },
    
    // Delete comment
    async delete(id) {
      try {
        const { error } = await api.client
          .from('comments')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        
        return true;
      } catch (error) {
        console.error('Error deleting comment:', error);
        throw error;
      }
    },
    
    // Subscribe to comment changes
    subscribe(issueId, callback) {
      return api.client
        .channel(`comments:${issueId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'comments',
            filter: `issue_id=eq.${issueId}`
          },
          callback
        )
        .subscribe();
    }
  },
  
  // Votes API
  votes: {
    // Get votes for an issue
    async getForIssue(issueId) {
      try {
        const { data: votes, error } = await api.client
          .from('votes')
          .select('*')
          .eq('issue_id', issueId);
        
        if (error) throw error;
        
        return votes || [];
      } catch (error) {
        console.error('Error getting votes:', error);
        throw error;
      }
    },
    
    // Toggle vote
    async toggle(issueId) {
      try {
        const userId = api.client.auth.user()?.id;
        if (!userId) throw new Error('User not authenticated');
        
        const { data: existingVote } = await api.client
          .from('votes')
          .select()
          .eq('issue_id', issueId)
          .eq('user_id', userId)
          .single();
        
        if (existingVote) {
          const { error } = await api.client
            .from('votes')
            .delete()
            .eq('id', existingVote.id);
          
          if (error) throw error;
          return false;
        } else {
          const { error } = await api.client
            .from('votes')
            .insert([{
              issue_id: issueId,
              user_id: userId
            }]);
          
          if (error) throw error;
          return true;
        }
      } catch (error) {
        console.error('Error toggling vote:', error);
        throw error;
      }
    },
    
    // Subscribe to vote changes
    subscribe(issueId, callback) {
      return api.client
        .channel(`votes:${issueId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'votes',
            filter: `issue_id=eq.${issueId}`
          },
          callback
        )
        .subscribe();
    }
  },
  
  // Profile API
  profiles: {
    // Get user profile
    async get(userId) {
      try {
        const { data: profile, error } = await api.client
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (error) throw error;
        
        return profile;
      } catch (error) {
        console.error('Error getting profile:', error);
        throw error;
      }
    },
    
    // Update profile
    async update(updates) {
      try {
        const userId = api.client.auth.user()?.id;
        if (!userId) throw new Error('User not authenticated');
        
        const { data: profile, error } = await api.client
          .from('profiles')
          .update(updates)
          .eq('id', userId)
          .select()
          .single();
        
        if (error) throw error;
        
        return profile;
      } catch (error) {
        console.error('Error updating profile:', error);
        throw error;
      }
    },
    
    // Upload avatar
    async uploadAvatar(file) {
      try {
        const userId = api.client.auth.user()?.id;
        if (!userId) throw new Error('User not authenticated');
        
        const fileExt = file.name.split('.').pop();
        const filePath = `${userId}/avatar.${fileExt}`;
        
        const { error: uploadError } = await api.client.storage
          .from('avatars')
          .upload(filePath, file, {
            upsert: true
          });
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = api.client.storage
          .from('avatars')
          .getPublicUrl(filePath);
        
        const { error: updateError } = await api.client
          .from('profiles')
          .update({
            avatar_url: publicUrl
          })
          .eq('id', userId);
        
        if (updateError) throw updateError;
        
        return publicUrl;
      } catch (error) {
        console.error('Error uploading avatar:', error);
        throw error;
      }
    }
  }
};

// Export API module
window.api = api; 