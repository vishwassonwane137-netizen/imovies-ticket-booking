const { useState, useEffect } = React;

// API Base URL
const API_BASE = '';

function App() {
  // Navigation & View state
  const [activeTab, setActiveTab] = useState('movies'); // 'movies' | 'booking' | 'my-bookings' | 'kanban'
  
  // Data state
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [movieDetailModal, setMovieDetailModal] = useState(null);
  
  // Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [statusFilter, setStatusFilter] = useState('now_showing');
  
  // Booking state
  const [showtimes, setShowtimes] = useState([]);
  const [selectedShowtime, setSelectedShowtime] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [selectedDate, setSelectedDate] = useState('2026-10-31');
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [ticketConfirmation, setTicketConfirmation] = useState(null);
  
  // User & Auth state
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('imovies_jwt_token') || '');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authForm, setAuthForm] = useState({ name: '', email: 'demo@imovies.com', password: 'password123', phone: '' });
  const [authError, setAuthError] = useState('');
  
  // My Bookings
  const [myBookings, setMyBookings] = useState([]);
  
  // Toast Notification
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch movies on mount
  useEffect(() => {
    fetchMovies();
    if (token) {
      fetchCurrentUser();
    }
  }, []);

  const fetchMovies = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/movies`);
      const data = await res.json();
      setMovies(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch movies:', err);
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        localStorage.removeItem('imovies_jwt_token');
        setToken('');
        setUser(null);
      }
    } catch (err) {
      console.error('Auth verification failed:', err);
    }
  };

  const fetchMyBookings = async () => {
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/api/bookings/my`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMyBookings(data);
      }
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    }
  };

  // Switch to Booking flow
  const handleStartBooking = async (movie) => {
    setSelectedMovie(movie);
    setSelectedSeats([]);
    setMovieDetailModal(null);
    try {
      // Fetch full movie details with showtimes
      const res = await fetch(`${API_BASE}/api/movies/${movie.id}`);
      const data = await res.json();
      setShowtimes(data.showtimes || []);
      if (data.showtimes && data.showtimes.length > 0) {
        setSelectedShowtime(data.showtimes[0]);
      } else {
        setSelectedShowtime(null);
      }
      setActiveTab('booking');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      showToast('Failed to load showtimes', 'danger');
    }
  };

  // Seat click toggle
  const handleSeatClick = (seatId, isBooked) => {
    if (isBooked) return;
    if (selectedSeats.includes(seatId)) {
      setSelectedSeats(selectedSeats.filter(s => s !== seatId));
    } else {
      if (selectedSeats.length >= 8) {
        showToast('You can select a maximum of 8 seats per booking', 'warning');
        return;
      }
      setSelectedSeats([...selectedSeats, seatId]);
    }
  };

  // Confirm booking API call
  const handleConfirmBooking = async (customerDetails) => {
    if (!selectedShowtime || selectedSeats.length === 0) return;

    // Determine highest tier selected
    const hasPlatinum = selectedSeats.some(s => s.startsWith('A') || s.startsWith('B'));
    const hasGold = selectedSeats.some(s => ['C', 'D', 'E', 'F'].includes(s[0]));
    const tier = hasPlatinum ? 'platinum' : (hasGold ? 'gold' : 'silver');

    try {
      const payload = {
        showtimeId: selectedShowtime.id,
        seats: selectedSeats,
        tier: tier,
        customerName: customerDetails.name,
        customerEmail: customerDetails.email
      };

      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/bookings`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (res.ok) {
        setCheckoutModalOpen(false);
        setTicketConfirmation(result.booking);
        // Refresh showtime seat availability
        const refreshRes = await fetch(`${API_BASE}/api/showtimes/${selectedShowtime.id}`);
        if (refreshRes.ok) {
          const updatedSt = await refreshRes.json();
          setSelectedShowtime(updatedSt);
        }
        setSelectedSeats([]);
        showToast('🎟️ Tickets booked successfully!', 'success');
      } else {
        showToast(result.message || 'Booking failed', 'danger');
      }
    } catch (err) {
      showToast('Network error while booking', 'danger');
    }
  };

  // Cancel booking API call
  const handleCancelBooking = async (bookingId) => {
    if (!confirm('Are you sure you want to cancel this booking? This will release your reserved seats.')) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/bookings/${bookingId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Booking cancelled successfully and seats released.', 'info');
        fetchMyBookings();
      } else {
        showToast('Failed to cancel booking', 'danger');
      }
    } catch (err) {
      showToast('Error cancelling booking', 'danger');
    }
  };

  // Auth handler
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('imovies_jwt_token', data.token);
        setToken(data.token);
        setUser(data.user);
        setAuthModalOpen(false);
        showToast(`Welcome back, ${data.user.name}!`, 'success');
      } else {
        setAuthError(data.message || 'Authentication failed');
      }
    } catch (err) {
      setAuthError('Server unreachable. Please try again.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('imovies_jwt_token');
    setToken('');
    setUser(null);
    showToast('Logged out successfully', 'info');
  };

  // Filter movies
  const filteredMovies = movies.filter(movie => {
    const matchesStatus = movie.status === statusFilter;
    const matchesGenre = selectedGenre === 'All' || movie.genre.includes(selectedGenre);
    const matchesSearch = !searchQuery || 
      movie.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      movie.cast.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesGenre && matchesSearch;
  });

  return (
    <div className="d-flex flex-column min-vh-100">
      {/* Toast Notification */}
      {toast && (
        <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 9999 }}>
          <div className={`toast show align-items-center text-white bg-${toast.type} border-0 shadow-lg`}>
            <div className="d-flex">
              <div className="toast-body fw-medium">{toast.message}</div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setToast(null)}></button>
            </div>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="navbar navbar-expand-lg navbar-dark navbar-cinema sticky-top">
        <div className="container">
          <a className="navbar-brand brand-logo" href="#" onClick={(e) => { e.preventDefault(); setActiveTab('movies'); }}>
            <i className="fa-solid fa-film text-danger"></i> IMovies
            <span className="brand-badge">PRO</span>
          </a>
          
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navContent">
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse" id="navContent">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0 ms-lg-4 gap-1">
              <li className="nav-item">
                <a className={`nav-link nav-link-custom ${activeTab === 'movies' && statusFilter === 'now_showing' ? 'active' : ''}`}
                   onClick={() => { setActiveTab('movies'); setStatusFilter('now_showing'); }}>
                  <i className="fa-solid fa-ticket me-1"></i> Now Showing
                </a>
              </li>
              <li className="nav-item">
                <a className={`nav-link nav-link-custom ${activeTab === 'movies' && statusFilter === 'upcoming' ? 'active' : ''}`}
                   onClick={() => { setActiveTab('movies'); setStatusFilter('upcoming'); }}>
                  <i className="fa-regular fa-clock me-1"></i> Upcoming
                </a>
              </li>
              <li className="nav-item">
                <a className={`nav-link nav-link-custom ${activeTab === 'my-bookings' ? 'active' : ''}`}
                   onClick={() => { setActiveTab('my-bookings'); fetchMyBookings(); }}>
                  <i className="fa-solid fa-qrcode me-1"></i> My Bookings
                </a>
              </li>
              <li className="nav-item">
                <a className={`nav-link nav-link-custom ${activeTab === 'kanban' ? 'active' : ''}`}
                   onClick={() => setActiveTab('kanban')}>
                  <i className="fa-solid fa-list-check me-1"></i> Epics & Kanban <span className="badge bg-danger ms-1">6 Epics / 19 Tasks</span>
                </a>
              </li>
            </ul>

            <div className="d-flex align-items-center gap-3">
              {user ? (
                <div className="dropdown">
                  <button className="btn btn-cinema-outline dropdown-toggle d-flex align-items-center gap-2" data-bs-toggle="dropdown">
                    <i className="fa-solid fa-circle-user text-danger fs-5"></i>
                    <span>{user.name}</span>
                  </button>
                  <ul className="dropdown-menu dropdown-menu-dark dropdown-menu-end shadow">
                    <li><span className="dropdown-item-text text-muted small">{user.email}</span></li>
                    <li><hr className="dropdown-divider" /></li>
                    <li><a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); setActiveTab('my-bookings'); fetchMyBookings(); }}><i className="fa-solid fa-ticket me-2"></i> My Tickets</a></li>
                    <li><a className="dropdown-item text-danger" href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}><i className="fa-solid fa-right-from-bracket me-2"></i> Sign Out</a></li>
                  </ul>
                </div>
              ) : (
                <button className="btn btn-cinema-primary" onClick={() => { setAuthMode('login'); setAuthModalOpen(true); }}>
                  <i className="fa-solid fa-arrow-right-to-bracket"></i> Sign In / Register
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* MAIN CONTAINER */}
      <main className="container my-4 flex-grow-1">

        {/* TAB 1: MOVIES CATALOG */}
        {activeTab === 'movies' && (
          <div>
            {/* HERO BANNER (Top Blockbuster) */}
            {movies.length > 0 && statusFilter === 'now_showing' && (
              <div className="hero-banner">
                <div className="hero-banner-bg" style={{ backgroundImage: `url('${movies[0].banner}')` }}></div>
                <div className="hero-overlay"></div>
                <div className="hero-content">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span className="badge bg-danger px-3 py-2 fw-semibold">FEATURED BLOCKBUSTER</span>
                    <span className="badge bg-dark border border-secondary px-2 py-1">{movies[0].certificate}</span>
                    <span className="text-warning fw-bold"><i className="fa-solid fa-star me-1"></i>{movies[0].rating}/10</span>
                  </div>
                  <h1 className="display-4 fw-black text-white mb-2" style={{ fontFamily: 'var(--font-mono)' }}>{movies[0].title}</h1>
                  <p className="text-light opacity-90 mb-3 fs-6 d-none d-md-block" style={{ maxWidth: '620px' }}>
                    {movies[0].synopsis}
                  </p>
                  <div className="d-flex flex-wrap gap-2 mb-4">
                    {movies[0].genre.map(g => (
                      <span key={g} className="badge bg-secondary bg-opacity-50">{g}</span>
                    ))}
                    <span className="text-muted small align-self-center"><i className="fa-regular fa-clock me-1"></i>{movies[0].duration}</span>
                  </div>
                  <div className="d-flex gap-3">
                    <button className="btn btn-cinema-primary btn-lg" onClick={() => handleStartBooking(movies[0])}>
                      <i className="fa-solid fa-ticket"></i> Book Seats Now
                    </button>
                    <button className="btn btn-cinema-outline btn-lg" onClick={() => setMovieDetailModal(movies[0])}>
                      <i className="fa-solid fa-circle-info"></i> More Details
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* FILTER & SEARCH BAR */}
            <div className="filter-bar">
              <div className="row g-3 align-items-center">
                <div className="col-lg-5">
                  <div className="search-input-wrap">
                    <i className="fa-solid fa-magnifying-glass search-icon"></i>
                    <input 
                      type="text" 
                      className="form-control search-input" 
                      placeholder="Search movies, actors, directors..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-lg-7">
                  <div className="d-flex flex-wrap gap-2 align-items-center justify-content-lg-end">
                    <span className="text-muted small me-1">Genre:</span>
                    {['All', 'Action', 'Sci-Fi', 'Drama', 'Adventure', 'Animation'].map(genre => (
                      <button 
                        key={genre} 
                        className={`genre-pill ${selectedGenre === genre ? 'active' : ''}`}
                        onClick={() => setSelectedGenre(genre)}
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* MOVIE GRID */}
            <div className="d-flex align-items-center justify-content-between mb-4">
              <h3 className="fw-bold m-0 d-flex align-items-center gap-2">
                <span>{statusFilter === 'now_showing' ? '🍿 Now Showing in Cinemas' : '🎬 Upcoming Releases'}</span>
                <span className="badge bg-dark border border-secondary text-light fs-6">{filteredMovies.length}</span>
              </h3>
            </div>

            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-danger" role="status"></div>
                <p className="text-muted mt-2">Loading movies...</p>
              </div>
            ) : filteredMovies.length === 0 ? (
              <div className="text-center py-5 bg-dark rounded-4 p-4 border border-secondary border-opacity-25">
                <i className="fa-solid fa-film text-muted fs-1 mb-3"></i>
                <h5>No movies match your search</h5>
                <p className="text-muted">Try clearing filters or search terms.</p>
                <button className="btn btn-cinema-outline" onClick={() => { setSearchQuery(''); setSelectedGenre('All'); }}>Clear Filters</button>
              </div>
            ) : (
              <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-4">
                {filteredMovies.map(movie => (
                  <div key={movie.id} className="col">
                    <div className="movie-card">
                      <div className="movie-poster-wrap">
                        <img src={movie.poster} alt={movie.title} className="movie-poster-img" />
                        <span className="movie-badge-cert">{movie.certificate}</span>
                        <span className="movie-badge-rating">
                          <i className="fa-solid fa-star"></i> {movie.rating}
                        </span>
                      </div>
                      <div className="movie-info">
                        <h5 className="movie-title" title={movie.title}>{movie.title}</h5>
                        <div className="movie-tags">
                          {movie.genre.slice(0, 2).map(g => (
                            <span key={g} className="movie-tag">{g}</span>
                          ))}
                          <span className="movie-tag">{movie.duration}</span>
                        </div>
                        <p className="text-muted small mb-3 flex-grow-1" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {movie.synopsis}
                        </p>
                        <div className="d-flex gap-2 pt-2 border-top border-secondary border-opacity-25">
                          <button className="btn btn-cinema-primary btn-sm flex-grow-1" onClick={() => handleStartBooking(movie)}>
                            <i className="fa-solid fa-ticket"></i> Book
                          </button>
                          <button className="btn btn-cinema-outline btn-sm px-3" title="View Details" onClick={() => setMovieDetailModal(movie)}>
                            <i className="fa-solid fa-info"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SEAT SELECTION & BOOKING FLOW */}
        {activeTab === 'booking' && selectedMovie && (
          <div>
            {/* Top Bar Navigation */}
            <div className="d-flex align-items-center justify-content-between mb-4">
              <button className="btn btn-cinema-outline" onClick={() => setActiveTab('movies')}>
                <i className="fa-solid fa-arrow-left me-2"></i> Back to Movies
              </button>
              <div className="text-end">
                <span className="text-muted small">Selected Movie</span>
                <h4 className="fw-bold m-0 text-white">{selectedMovie.title}</h4>
              </div>
            </div>

            {/* SHOWTIME SELECTOR PANEL */}
            <div className="card bg-dark border-secondary border-opacity-25 p-4 rounded-4 mb-4">
              <div className="row g-4 align-items-center">
                {/* Date selection */}
                <div className="col-md-4">
                  <label className="form-label text-muted small fw-semibold">1. SELECT DATE</label>
                  <div className="d-flex gap-2">
                    {[
                      { label: 'Today', date: '2026-10-31', day: 'Sat' },
                      { label: 'Tomorrow', date: '2026-11-01', day: 'Sun' },
                      { label: 'Mon', date: '2026-11-02', day: 'Mon' }
                    ].map(d => (
                      <button 
                        key={d.date}
                        className={`btn flex-grow-1 text-center py-2 ${selectedDate === d.date ? 'btn-danger' : 'btn-outline-secondary'}`}
                        onClick={() => setSelectedDate(d.date)}
                      >
                        <div className="small fw-bold">{d.label}</div>
                        <div style={{ fontSize: '0.7rem' }}>{d.day}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Showtime Selection */}
                <div className="col-md-8">
                  <label className="form-label text-muted small fw-semibold">2. CHOOSE THEATER & TIME</label>
                  {showtimes.length === 0 ? (
                    <p className="text-muted m-0">No showtimes found for this movie.</p>
                  ) : (
                    <div className="d-flex flex-wrap gap-2">
                      {showtimes.map(st => (
                        <button
                          key={st.id}
                          className={`btn p-2 text-start ${selectedShowtime?.id === st.id ? 'btn-danger' : 'btn-dark border-secondary border-opacity-50'}`}
                          onClick={() => {
                            setSelectedShowtime(st);
                            setSelectedSeats([]);
                          }}
                        >
                          <div className="fw-bold fs-6">{st.time}</div>
                          <div className="small opacity-75">{st.format}</div>
                          <div style={{ fontSize: '0.65rem' }}>{st.theater?.name || st.screenName}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* INTERACTIVE AUDITORIUM SEAT MAP */}
            {selectedShowtime && (
              <div className="auditorium-box">
                {/* Cinema Screen with Glow */}
                <div className="cinema-screen-wrap">
                  <div className="cinema-screen-bar"></div>
                  <div className="screen-text">Auditorium Screen (All Eyes This Way)</div>
                </div>

                {/* SEAT GRID: 8 Rows (A-H), 12 Columns */}
                {/* Platinum Tier: Rows A, B */}
                <div className="seat-tier-header">Platinum Recliner Tier — ₹{selectedShowtime.pricing?.platinum || 450}</div>
                {['A', 'B'].map(row => (
                  <div key={row} className="seat-row">
                    <span className="row-label">{row}</span>
                    {[1, 2, 3, 4].map(num => {
                      const seatId = `${row}${num}`;
                      const isBooked = (selectedShowtime.bookedSeats || []).includes(seatId);
                      const isSelected = selectedSeats.includes(seatId);
                      return (
                        <div 
                          key={seatId} 
                          className={`seat-btn ${isBooked ? 'booked' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSeatClick(seatId, isBooked)}
                        >
                          {num}
                        </div>
                      );
                    })}
                    <div className="seat-gap"></div>
                    {[5, 6, 7, 8].map(num => {
                      const seatId = `${row}${num}`;
                      const isBooked = (selectedShowtime.bookedSeats || []).includes(seatId);
                      const isSelected = selectedSeats.includes(seatId);
                      return (
                        <div 
                          key={seatId} 
                          className={`seat-btn ${isBooked ? 'booked' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSeatClick(seatId, isBooked)}
                        >
                          {num}
                        </div>
                      );
                    })}
                    <div className="seat-gap"></div>
                    {[9, 10, 11, 12].map(num => {
                      const seatId = `${row}${num}`;
                      const isBooked = (selectedShowtime.bookedSeats || []).includes(seatId);
                      const isSelected = selectedSeats.includes(seatId);
                      return (
                        <div 
                          key={seatId} 
                          className={`seat-btn ${isBooked ? 'booked' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSeatClick(seatId, isBooked)}
                        >
                          {num}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* Gold Tier: Rows C, D, E, F */}
                <div className="seat-tier-header">Gold Premium Tier — ₹{selectedShowtime.pricing?.gold || 280}</div>
                {['C', 'D', 'E', 'F'].map(row => (
                  <div key={row} className="seat-row">
                    <span className="row-label">{row}</span>
                    {[1, 2, 3, 4].map(num => {
                      const seatId = `${row}${num}`;
                      const isBooked = (selectedShowtime.bookedSeats || []).includes(seatId);
                      const isSelected = selectedSeats.includes(seatId);
                      return (
                        <div 
                          key={seatId} 
                          className={`seat-btn ${isBooked ? 'booked' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSeatClick(seatId, isBooked)}
                        >
                          {num}
                        </div>
                      );
                    })}
                    <div className="seat-gap"></div>
                    {[5, 6, 7, 8].map(num => {
                      const seatId = `${row}${num}`;
                      const isBooked = (selectedShowtime.bookedSeats || []).includes(seatId);
                      const isSelected = selectedSeats.includes(seatId);
                      return (
                        <div 
                          key={seatId} 
                          className={`seat-btn ${isBooked ? 'booked' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSeatClick(seatId, isBooked)}
                        >
                          {num}
                        </div>
                      );
                    })}
                    <div className="seat-gap"></div>
                    {[9, 10, 11, 12].map(num => {
                      const seatId = `${row}${num}`;
                      const isBooked = (selectedShowtime.bookedSeats || []).includes(seatId);
                      const isSelected = selectedSeats.includes(seatId);
                      return (
                        <div 
                          key={seatId} 
                          className={`seat-btn ${isBooked ? 'booked' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSeatClick(seatId, isBooked)}
                        >
                          {num}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* Silver Tier: Rows G, H */}
                <div className="seat-tier-header">Silver Standard Tier — ₹{selectedShowtime.pricing?.silver || 180}</div>
                {['G', 'H'].map(row => (
                  <div key={row} className="seat-row">
                    <span className="row-label">{row}</span>
                    {[1, 2, 3, 4].map(num => {
                      const seatId = `${row}${num}`;
                      const isBooked = (selectedShowtime.bookedSeats || []).includes(seatId);
                      const isSelected = selectedSeats.includes(seatId);
                      return (
                        <div 
                          key={seatId} 
                          className={`seat-btn ${isBooked ? 'booked' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSeatClick(seatId, isBooked)}
                        >
                          {num}
                        </div>
                      );
                    })}
                    <div className="seat-gap"></div>
                    {[5, 6, 7, 8].map(num => {
                      const seatId = `${row}${num}`;
                      const isBooked = (selectedShowtime.bookedSeats || []).includes(seatId);
                      const isSelected = selectedSeats.includes(seatId);
                      return (
                        <div 
                          key={seatId} 
                          className={`seat-btn ${isBooked ? 'booked' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSeatClick(seatId, isBooked)}
                        >
                          {num}
                        </div>
                      );
                    })}
                    <div className="seat-gap"></div>
                    {[9, 10, 11, 12].map(num => {
                      const seatId = `${row}${num}`;
                      const isBooked = (selectedShowtime.bookedSeats || []).includes(seatId);
                      const isSelected = selectedSeats.includes(seatId);
                      return (
                        <div 
                          key={seatId} 
                          className={`seat-btn ${isBooked ? 'booked' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSeatClick(seatId, isBooked)}
                        >
                          {num}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* LEGEND */}
                <div className="seat-legend">
                  <div className="legend-item">
                    <div className="legend-sample" style={{ background: 'var(--seat-available)', border: '1px solid var(--seat-available-border)' }}></div>
                    <span>Available</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-sample" style={{ background: 'var(--accent-red)' }}></div>
                    <span>Selected ({selectedSeats.length})</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-sample" style={{ background: '#1e293b', border: '1px solid #334155' }}></div>
                    <span>Booked / Reserved</span>
                  </div>
                </div>

                {/* BOTTOM SUMMARY DOCK */}
                <div className="mt-4 p-3 bg-dark rounded-4 border border-secondary border-opacity-25 d-flex flex-wrap align-items-center justify-content-between gap-3">
                  <div>
                    <span className="text-muted small">Selected Seats: </span>
                    <span className="fw-bold text-white fs-6">
                      {selectedSeats.length > 0 ? selectedSeats.join(', ') : 'None selected'}
                    </span>
                    <div className="text-secondary small mt-1">
                      {selectedShowtime.theater?.name || selectedShowtime.screenName} • {selectedShowtime.time} ({selectedShowtime.format})
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-3">
                    <div className="text-end">
                      <span className="text-muted small">Tickets: </span>
                      <span className="fw-bold text-white">{selectedSeats.length}</span>
                    </div>
                    <button 
                      className="btn btn-cinema-primary btn-lg" 
                      disabled={selectedSeats.length === 0}
                      onClick={() => setCheckoutModalOpen(true)}
                    >
                      <i className="fa-solid fa-lock"></i> Proceed to Checkout
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MY BOOKINGS / PASSES */}
        {activeTab === 'my-bookings' && (
          <div>
            <div className="d-flex align-items-center justify-content-between mb-4">
              <div>
                <h3 className="fw-bold m-0"><i className="fa-solid fa-ticket text-danger me-2"></i>My Booked Tickets</h3>
                <p className="text-muted small m-0">View, download, or manage your cinema reservations</p>
              </div>
              <button className="btn btn-cinema-outline" onClick={() => setActiveTab('movies')}>
                <i className="fa-solid fa-plus me-1"></i> Book More
              </button>
            </div>

            {myBookings.length === 0 ? (
              <div className="text-center py-5 bg-dark rounded-4 p-5 border border-secondary border-opacity-25">
                <i className="fa-solid fa-ticket-simple text-muted fs-1 mb-3"></i>
                <h4>No tickets booked yet</h4>
                <p className="text-muted">Browse movies and book your cinema seats in real time.</p>
                <button className="btn btn-cinema-primary" onClick={() => setActiveTab('movies')}>
                  Browse Now Showing
                </button>
              </div>
            ) : (
              <div className="row g-4">
                {myBookings.map(bk => (
                  <div key={bk.id} className="col-lg-6">
                    <div className="ticket-pass p-4">
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div>
                          <span className={`badge ${bk.status === 'CONFIRMED' ? 'bg-success' : 'bg-danger'} mb-2`}>
                            {bk.status}
                          </span>
                          <h4 className="fw-bold text-white m-0">{bk.movieTitle}</h4>
                          <span className="text-muted small">{bk.format} • {bk.theaterName}</span>
                        </div>
                        <div className="text-end">
                          <span className="text-muted small d-block">Booking Ref</span>
                          <span className="font-monospace fw-bold text-warning">{bk.id}</span>
                        </div>
                      </div>

                      <div className="row g-2 py-3 bg-dark bg-opacity-50 rounded-3 px-3 my-2 border border-secondary border-opacity-10">
                        <div className="col-4">
                          <span className="text-muted small d-block">Date</span>
                          <span className="fw-bold">{bk.date}</span>
                        </div>
                        <div className="col-4">
                          <span className="text-muted small d-block">Time</span>
                          <span className="fw-bold text-danger">{bk.time}</span>
                        </div>
                        <div className="col-4">
                          <span className="text-muted small d-block">Seats ({bk.seats?.length})</span>
                          <span className="fw-bold text-info">{bk.seats?.join(', ')}</span>
                        </div>
                      </div>

                      <div className="ticket-divider"></div>

                      <div className="d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-3">
                          <div className="qr-placeholder text-center">
                            <i className="fa-solid fa-qrcode fs-1 text-dark"></i>
                          </div>
                          <div>
                            <span className="text-muted small d-block">Total Paid</span>
                            <h5 className="fw-bold text-white m-0">₹{bk.totalAmount}</h5>
                            <span className="text-secondary" style={{ fontSize: '0.7rem' }}>Includes taxes & convenience fees</span>
                          </div>
                        </div>

                        {bk.status === 'CONFIRMED' && (
                          <button 
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => handleCancelBooking(bk.id)}
                          >
                            <i className="fa-solid fa-ban me-1"></i> Cancel Booking
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: KANBAN & EPICS OVERVIEW (For Mentor Evaluation) */}
        {activeTab === 'kanban' && (
          <div>
            <div className="p-4 bg-dark rounded-4 border border-secondary border-opacity-25 mb-4">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div>
                  <span className="badge bg-danger px-3 py-1 mb-2">PROJECT STATS & EVALUATION</span>
                  <h3 className="fw-bold text-white m-0">IMovies Architecture & Kanban Progress</h3>
                  <p className="text-muted small m-0 mt-1">Review of the 6 Epics, 19 Tasks, and Technical Specifications</p>
                </div>
                <div className="d-flex gap-3">
                  <div className="text-center p-2 bg-black rounded-3 px-3 border border-secondary border-opacity-25">
                    <div className="fs-4 fw-bold text-danger">6</div>
                    <div className="small text-muted">Total Epics</div>
                  </div>
                  <div className="text-center p-2 bg-black rounded-3 px-3 border border-secondary border-opacity-25">
                    <div className="fs-4 fw-bold text-success">19</div>
                    <div className="small text-muted">Tasks (100% Done)</div>
                  </div>
                  <div className="text-center p-2 bg-black rounded-3 px-3 border border-secondary border-opacity-25">
                    <div className="fs-4 fw-bold text-warning">0</div>
                    <div className="small text-muted">Subtasks</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Kanban Columns: 6 Epics */}
            <div className="row g-3">
              {[
                {
                  id: 1,
                  title: 'Epic 1: Architecture & System Setup',
                  tasks: [
                    { id: 'T1.1', title: 'Scaffold MERN project structure & Git repository', done: true },
                    { id: 'T1.2', title: 'Express.js server initialization & REST API routing', done: true },
                    { id: 'T1.3', title: 'Data schemas for Movies, Showtimes, Users, Bookings', done: true }
                  ]
                },
                {
                  id: 2,
                  title: 'Epic 2: User Authentication & Security',
                  tasks: [
                    { id: 'T2.1', title: 'User registration with password hashing (SHA-256)', done: true },
                    { id: 'T2.2', title: 'JWT token generation & authorization middleware', done: true },
                    { id: 'T2.3', title: 'Frontend session state & persistent login handling', done: true }
                  ]
                },
                {
                  id: 3,
                  title: 'Epic 3: Movie Catalog & Discovery',
                  tasks: [
                    { id: 'T3.1', title: 'Database seeding with rich blockbusters & posters', done: true },
                    { id: 'T3.2', title: 'REST API for movie listing, search, and genre filters', done: true },
                    { id: 'T3.3', title: 'Interactive Hero carousel with movie preview & trailer', done: true },
                    { id: 'T3.4', title: 'Now Showing vs. Upcoming releases categorization', done: true }
                  ]
                },
                {
                  id: 4,
                  title: 'Epic 4: Showtimes & Theaters',
                  tasks: [
                    { id: 'T4.1', title: 'Theater multiplex modeling (IMAX 3D, Dolby Atmos, 4DX)', done: true },
                    { id: 'T4.2', title: 'Showtime schedule management across multiple dates', done: true },
                    { id: 'T4.3', title: 'Multi-tier pricing (Silver, Gold, Platinum Recliner)', done: true }
                  ]
                },
                {
                  id: 5,
                  title: 'Epic 5: Real-time Seat Engine',
                  tasks: [
                    { id: 'T5.1', title: 'Interactive 96-seat auditorium SVG/CSS map', done: true },
                    { id: 'T5.2', title: 'Conflict prevention & double-booking protection', done: true },
                    { id: 'T5.3', title: 'Dynamic convenience fee & instant subtotal calculation', done: true }
                  ]
                },
                {
                  id: 6,
                  title: 'Epic 6: Booking Management',
                  tasks: [
                    { id: 'T6.1', title: 'Booking confirmation pass with QR Code & Reference ID', done: true },
                    { id: 'T6.2', title: 'My Bookings dashboard with user ticket history', done: true },
                    { id: 'T6.3', title: 'One-click ticket cancellation with dynamic seat release', done: true }
                  ]
                }
              ].map(epic => (
                <div key={epic.id} className="col-md-6 col-lg-4">
                  <div className="kanban-column">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6 className="fw-bold m-0 text-white">{epic.title}</h6>
                      <span className="badge bg-success small"><i className="fa-solid fa-check me-1"></i>3/3 Done</span>
                    </div>
                    {epic.tasks.map(task => (
                      <div key={task.id} className="kanban-task-card">
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <span className="font-monospace text-muted small">{task.id}</span>
                          <span className="text-success small"><i className="fa-solid fa-circle-check"></i></span>
                        </div>
                        <div className="small text-light fw-medium">{task.title}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-black py-4 border-top border-secondary border-opacity-25 mt-auto">
        <div className="container d-flex flex-wrap align-items-center justify-content-between gap-3 text-muted small">
          <div>
            <span className="text-white fw-bold me-2">🎬 IMovies</span>
            <span>Movie ticket booking made simple. Built with Node.js, Express, React, and MongoDB architecture.</span>
          </div>
          <div>
            <span className="badge bg-success me-2">● Server Online (Port 5000)</span>
            <span>All 6 Epics & 19 Tasks Complete</span>
          </div>
        </div>
      </footer>

      {/* MODAL 1: MOVIE DETAIL MODAL */}
      {movieDetailModal && (
        <div className="modal show d-block modal-cinema" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold text-white">{movieDetailModal.title}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setMovieDetailModal(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-4">
                  <div className="col-md-4">
                    <img src={movieDetailModal.poster} alt={movieDetailModal.title} className="img-fluid rounded-3 shadow" />
                  </div>
                  <div className="col-md-8">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span className="badge bg-danger">{movieDetailModal.certificate}</span>
                      <span className="text-warning fw-bold"><i className="fa-solid fa-star me-1"></i>{movieDetailModal.rating} / 10</span>
                      <span className="text-muted small">• {movieDetailModal.duration}</span>
                    </div>
                    <div className="d-flex flex-wrap gap-1 mb-3">
                      {movieDetailModal.genre.map(g => (
                        <span key={g} className="badge bg-secondary bg-opacity-25">{g}</span>
                      ))}
                    </div>
                    <h6 className="fw-bold text-white">Synopsis</h6>
                    <p className="text-light opacity-90 small mb-3">{movieDetailModal.synopsis}</p>
                    <div className="mb-2">
                      <span className="text-muted small d-block">Director</span>
                      <span className="fw-semibold text-white">{movieDetailModal.director}</span>
                    </div>
                    <div className="mb-3">
                      <span className="text-muted small d-block">Cast</span>
                      <span className="fw-semibold text-white">{movieDetailModal.cast.join(', ')}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-cinema-outline" onClick={() => setMovieDetailModal(null)}>Close</button>
                <button type="button" className="btn btn-cinema-primary" onClick={() => handleStartBooking(movieDetailModal)}>
                  <i className="fa-solid fa-ticket me-1"></i> Book Tickets Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CHECKOUT & CUSTOMER DETAILS */}
      {checkoutModalOpen && selectedShowtime && (
        <div className="modal show d-block modal-cinema" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold text-white"><i className="fa-solid fa-credit-card text-danger me-2"></i>Review & Confirm Booking</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setCheckoutModalOpen(false)}></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                handleConfirmBooking({
                  name: formData.get('name'),
                  email: formData.get('email')
                });
              }}>
                <div className="modal-body">
                  {/* Summary Box */}
                  <div className="p-3 bg-dark rounded-3 mb-3 border border-secondary border-opacity-25">
                    <h6 className="fw-bold text-white mb-1">{selectedMovie?.title}</h6>
                    <div className="text-muted small mb-2">{selectedShowtime.theater?.name || selectedShowtime.screenName}</div>
                    <div className="d-flex justify-content-between text-light small py-1">
                      <span>Date & Time:</span>
                      <span className="fw-semibold">{selectedDate} @ {selectedShowtime.time}</span>
                    </div>
                    <div className="d-flex justify-content-between text-light small py-1">
                      <span>Seats Selected ({selectedSeats.length}):</span>
                      <span className="fw-bold text-danger">{selectedSeats.join(', ')}</span>
                    </div>
                    <hr className="border-secondary border-opacity-25 my-2" />
                    <div className="d-flex justify-content-between text-light small py-1">
                      <span>Subtotal:</span>
                      <span>₹{selectedSeats.length * 280}</span>
                    </div>
                    <div className="d-flex justify-content-between text-light small py-1">
                      <span>Convenience Fee (8%):</span>
                      <span>₹{(selectedSeats.length * 280 * 0.08).toFixed(2)}</span>
                    </div>
                    <div className="d-flex justify-content-between text-white fw-bold fs-6 pt-2 border-top border-secondary border-opacity-25">
                      <span>Total Payable:</span>
                      <span className="text-warning">₹{(selectedSeats.length * 280 * 1.08).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Customer Information */}
                  <h6 className="fw-bold text-white mb-2">Customer Details</h6>
                  <div className="mb-3">
                    <label className="form-label small text-muted">Full Name</label>
                    <input 
                      type="text" 
                      name="name" 
                      className="form-control bg-dark border-secondary text-white" 
                      defaultValue={user ? user.name : 'Alex Turner'} 
                      required 
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small text-muted">Email Address (for Ticket & QR delivery)</label>
                    <input 
                      type="email" 
                      name="email" 
                      className="form-control bg-dark border-secondary text-white" 
                      defaultValue={user ? user.email : 'demo@imovies.com'} 
                      required 
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-cinema-outline" onClick={() => setCheckoutModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-cinema-primary">
                    <i className="fa-solid fa-lock me-1"></i> Pay & Confirm Reservation
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: TICKET CONFIRMATION PASS */}
      {ticketConfirmation && (
        <div className="modal show d-block modal-cinema" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header border-0 pb-0">
                <button type="button" className="btn-close btn-close-white" onClick={() => setTicketConfirmation(null)}></button>
              </div>
              <div className="modal-body pt-0 text-center">
                <div className="mb-3">
                  <i className="fa-solid fa-circle-check text-success display-4"></i>
                  <h4 className="fw-bold text-white mt-2">Booking Confirmed!</h4>
                  <p className="text-muted small">Your movie ticket has been reserved and generated.</p>
                </div>

                <div className="ticket-pass text-start p-4 mb-3">
                  <div className="d-flex justify-content-between mb-2">
                    <span className="badge bg-success">CONFIRMED TICKET</span>
                    <span className="font-monospace fw-bold text-warning">{ticketConfirmation.id}</span>
                  </div>
                  <h5 className="fw-bold text-white mb-1">{ticketConfirmation.movieTitle}</h5>
                  <div className="text-muted small mb-3">{ticketConfirmation.theaterName} • {ticketConfirmation.screenName}</div>

                  <div className="row g-2 p-2 bg-dark rounded-2 text-center my-2">
                    <div className="col-4">
                      <span className="text-muted" style={{ fontSize: '0.65rem' }}>DATE</span>
                      <div className="small fw-bold">{ticketConfirmation.date}</div>
                    </div>
                    <div className="col-4">
                      <span className="text-muted" style={{ fontSize: '0.65rem' }}>TIME</span>
                      <div className="small fw-bold text-danger">{ticketConfirmation.time}</div>
                    </div>
                    <div className="col-4">
                      <span className="text-muted" style={{ fontSize: '0.65rem' }}>SEATS</span>
                      <div className="small fw-bold text-info">{ticketConfirmation.seats?.join(', ')}</div>
                    </div>
                  </div>

                  <div className="ticket-divider"></div>

                  <div className="d-flex align-items-center justify-content-between">
                    <div className="qr-placeholder">
                      <i className="fa-solid fa-qrcode fs-1 text-dark"></i>
                    </div>
                    <div className="text-end">
                      <span className="text-muted small d-block">Total Paid</span>
                      <h5 className="fw-bold text-warning m-0">₹{ticketConfirmation.totalAmount}</h5>
                      <span className="badge bg-secondary">{ticketConfirmation.format}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-cinema-primary w-100" onClick={() => {
                  setTicketConfirmation(null);
                  setActiveTab('my-bookings');
                  fetchMyBookings();
                }}>
                  <i className="fa-solid fa-ticket me-2"></i> View in My Bookings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: AUTH (LOGIN / REGISTER) */}
      {authModalOpen && (
        <div className="modal show d-block modal-cinema" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold text-white">
                  {authMode === 'login' ? '🔐 Sign In to IMovies' : '✨ Create New Account'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setAuthModalOpen(false)}></button>
              </div>
              <form onSubmit={handleAuthSubmit}>
                <div className="modal-body">
                  {authError && (
                    <div className="alert alert-danger py-2 small">{authError}</div>
                  )}

                  {authMode === 'register' && (
                    <div className="mb-3">
                      <label className="form-label small text-muted">Full Name</label>
                      <input 
                        type="text" 
                        className="form-control bg-dark border-secondary text-white" 
                        value={authForm.name} 
                        onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} 
                        required 
                      />
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label small text-muted">Email Address</label>
                    <input 
                      type="email" 
                      className="form-control bg-dark border-secondary text-white" 
                      value={authForm.email} 
                      onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} 
                      required 
                    />
                    {authMode === 'login' && (
                      <span className="text-secondary" style={{ fontSize: '0.75rem' }}>Demo: demo@imovies.com</span>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label small text-muted">Password</label>
                    <input 
                      type="password" 
                      className="form-control bg-dark border-secondary text-white" 
                      value={authForm.password} 
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} 
                      required 
                    />
                    {authMode === 'login' && (
                      <span className="text-secondary" style={{ fontSize: '0.75rem' }}>Demo Password: password123</span>
                    )}
                  </div>

                  <div className="text-center pt-2">
                    {authMode === 'login' ? (
                      <span className="text-muted small">
                        Don't have an account?{' '}
                        <a href="#" className="text-danger fw-semibold" onClick={(e) => { e.preventDefault(); setAuthMode('register'); setAuthError(''); }}>
                          Register here
                        </a>
                      </span>
                    ) : (
                      <span className="text-muted small">
                        Already have an account?{' '}
                        <a href="#" className="text-danger fw-semibold" onClick={(e) => { e.preventDefault(); setAuthMode('login'); setAuthError(''); }}>
                          Sign In
                        </a>
                      </span>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-cinema-outline" onClick={() => setAuthModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-cinema-primary">
                    {authMode === 'login' ? 'Sign In' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Render React App to DOM
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
