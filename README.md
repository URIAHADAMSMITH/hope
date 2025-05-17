# Earth - Direct Democracy Platform

A comprehensive platform for global democratic participation, enabling people worldwide to engage in discussions, vote on important issues, and track global sentiment in real-time.

## Features

- **Interactive World Map**: Visualize and participate in global issues with an intuitive map interface
- **Location-Based Polls**: View and participate in polls specific to your region
- **Forums**: Engage in meaningful discussions across various categories
- **Real-time Analytics**: Track participation and monitor global trends
- **User Authentication**: Secure account creation and management
- **Poll Creation**: Create and participate in polls on global issues
- **Mobile Responsive**: Fully responsive design for all devices

## Technology Stack

- Frontend: HTML5, CSS3, JavaScript
- Map Integration: Mapbox GL JS
- Authentication & Backend: Supabase
- Data Visualization: Chart.js
- Icons: Font Awesome

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/earth.git
cd earth
```

2. Set up environment variables:
Create a `.env` file with your Supabase and Mapbox credentials:
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
MAPBOX_TOKEN=your_mapbox_token
```

3. Install dependencies:
```bash
npm install
```

4. Run the development server:
```bash
npm start
```

## Project Structure

```
app/
├── index.html      # Main page with world map
├── forums.html     # Forums page
├── analytics.html  # Analytics dashboard
├── about.html      # About page
├── style.css       # Global styles
├── script.js       # Main JavaScript
├── forums.js       # Forums functionality
├── analytics.js    # Analytics functionality
└── about.js        # About page functionality
```

## Database Schema

### Users
- id: uuid
- email: string
- created_at: timestamp

### Polls
- id: uuid
- title: string
- description: text
- category: string
- options: array
- location_type: string (global, continent, country, state)
- location_name: string
- latitude: float
- longitude: float
- user_id: uuid (foreign key)
- created_at: timestamp
- votes_count: integer
- comments_count: integer

### Votes
- id: uuid
- poll_id: uuid (foreign key)
- user_id: uuid (foreign key)
- option: string
- created_at: timestamp

### Comments
- id: uuid
- poll_id: uuid (foreign key)
- user_id: uuid (foreign key)
- content: text
- created_at: timestamp

### Tags
- id: uuid
- name: string
- usage_count: integer

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

- Email: contact@earth.world
- Twitter: [@EarthPlatform](https://twitter.com/EarthPlatform)
- GitHub: [github.com/EarthPlatform](https://github.com/EarthPlatform) 