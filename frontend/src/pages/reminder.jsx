import React, { useState, useEffect, useContext, useRef } from 'react';
import { Bell, Calendar, Clock, Check, Plus, Trash2, Filter, ChevronDown, Pill, Repeat, AlertCircle, X, TrendingUp, MapPin, Phone, Navigation } from 'lucide-react';
import Sidebar from '../../components/sidebar';
import { AppContext } from "../context/AppContext";

const Reminders = () => {
  const { prescriptionHistory, medicationData, reminders, setReminders } = useContext(AppContext);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [newReminder, setNewReminder] = useState({
    id: '',
    title: '',
    medication: '',
    description: '',
    time: '',
    date: new Date().toISOString().split('T')[0],
    priority: 'medium',
    completed: false,
    recurring: 'daily',
    takenHistory: [],
  });
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState('weekly');
  const [showNotification, setShowNotification] = useState(false);
  const [activeNotification, setActiveNotification] = useState(null);
  const notificationAudioRef = useRef(null);
  const notificationCheckIntervalRef = useRef(null);

  // State for pharmacies toggle and data
  const [showPharmacies, setShowPharmacies] = useState(false);
  const [pharmacies, setPharmacies] = useState([]);
  const [locationError, setLocationError] = useState(null);
  const [isLoadingPharmacies, setIsLoadingPharmacies] = useState(false);
  const [userLocation, setUserLocation] = useState(null); // Store user's location

  // Persist reminders to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('reminders', JSON.stringify(reminders));
  }, [reminders]);

  // Request notification permission on component mount
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  // Set up notification checking
  useEffect(() => {
    notificationCheckIntervalRef.current = setInterval(checkForDueReminders, 60000);
    checkForDueReminders();
    return () => {
      if (notificationCheckIntervalRef.current) {
        clearInterval(notificationCheckIntervalRef.current);
      }
    };
  }, [reminders]);

  // Fetch pharmacies when showPharmacies is enabled
  useEffect(() => {
    if (showPharmacies) {
      setIsLoadingPharmacies(true);
      setLocationError(null);
      setPharmacies([]);
      setUserLocation(null);

      if (!navigator.geolocation) {
        setLocationError('Geolocation is not supported by your browser.');
        setIsLoadingPharmacies(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ latitude, longitude });
          try {
            const response = await fetch(`http://localhost:5000/api/pharmacies?lat=${latitude}&lon=${longitude}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            });

            if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            if (Array.isArray(data)) {
              setPharmacies(data);
            } else {
              setPharmacies([]);
              setLocationError('No pharmacies found in the response.');
            }
          } catch (error) {
            console.error('Error fetching pharmacies:', error);
            setLocationError('Failed to fetch pharmacies. Please check your network or try again later.');
          } finally {
            setIsLoadingPharmacies(false);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          let errorMessage = 'Unable to get your location. Please enable location services.';
          if (error.code === error.PERMISSION_DENIED) {
            errorMessage = 'Location access was denied. Please allow location access to find nearby pharmacies.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errorMessage = 'Location information is unavailable.';
          } else if (error.code === error.TIMEOUT) {
            errorMessage = 'The request to get your location timed out.';
          }
          setLocationError(errorMessage);
          setIsLoadingPharmacies(false);
        },
        {
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    } else {
      setPharmacies([]);
      setLocationError(null);
      setIsLoadingPharmacies(false);
      setUserLocation(null);
    }
  }, [showPharmacies]);

  // Generate OpenStreetMap directions URL
  const getDirectionsUrl = (pharmacy) => {
    if (!userLocation) {
      return '#';
    }

    const { latitude: startLat, longitude: startLon } = userLocation;

    if (pharmacy.latitude && pharmacy.longitude) {
      return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${startLat}%2C${startLon}%3B${pharmacy.latitude}%2C${pharmacy.longitude}`;
    }

    const encodedAddress = encodeURIComponent(pharmacy.address || '');
    return `https://www.openstreetmap.org/directions?from=${startLat}%2C${startLon}&to=${encodedAddress}`;
  };

  const checkForDueReminders = () => {
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const currentDate = now.toISOString().split('T')[0];

    const dueReminders = reminders.filter(reminder => {
      if (reminder.completed) return false;
      if (reminder.date !== currentDate) return false;
      const reminderTimeParts = reminder.time.split(':');
      const reminderHour = reminderTimeParts[0];
      const reminderMinute = reminderTimeParts[1];
      return reminderHour === now.getHours().toString().padStart(2, '0') &&
             reminderMinute === now.getMinutes().toString().padStart(2, '0');
    });

    if (dueReminders.length > 0) {
      const firstDueReminder = dueReminders[0];
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Medication Reminder", {
          body: `Time to take ${firstDueReminder.medication || firstDueReminder.title}`,
          icon: "/favicon.ico"
        });
      }
      setActiveNotification(firstDueReminder);
      setShowNotification(true);
      if (notificationAudioRef.current) {
        notificationAudioRef.current.play().catch(e => console.log("Audio play failed:", e));
      }
    }
  };

  const handleAddReminder = () => {
    if (newReminder.title && newReminder.time) {
      const updatedReminder = {
        ...newReminder,
        id: `manual-${Date.now()}`,
        isAutoGenerated: false,
        takenHistory: [],
      };
      setReminders(prev => [...prev, updatedReminder]);
      setNewReminder({
        id: '',
        title: '',
        medication: '',
        description: '',
        time: '',
        date: new Date().toISOString().split('T')[0],
        priority: 'medium',
        completed: false,
        recurring: 'daily',
        takenHistory: [],
      });
      setShowAddReminder(false);
    }
  };

  const handleToggleComplete = (id) => {
    setReminders(prev =>
      prev.map(reminder =>
        reminder.id === id ? { ...reminder, completed: !reminder.completed } : reminder
      )
    );
  };

  const handleMarkTaken = (id) => {
    setReminders(prev =>
      prev.map(reminder => {
        if (reminder.id === id && !reminder.completed) {
          const now = new Date();
          return {
            ...reminder,
            completed: true,
            takenHistory: [...reminder.takenHistory, now.toISOString()],
          };
        }
        return reminder;
      })
    );
    if (activeNotification && activeNotification.id === id) {
      dismissNotification();
    }
  };

  const dismissNotification = () => {
    setShowNotification(false);
    setActiveNotification(null);
  };

  const handleDeleteReminder = (id) => {
    setReminders(prev => prev.filter(reminder => reminder.id !== id));
    if (activeNotification && activeNotification.id === id) {
      dismissNotification();
    }
  };

  const handleCancelAdd = () => {
    setShowAddReminder(false);
    setNewReminder({
      id: '',
      title: '',
      medication: '',
      description: '',
      time: '',
      date: new Date().toISOString().split('T')[0],
      priority: 'medium',
      completed: false,
      recurring: 'daily',
      takenHistory: [],
    });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-400 bg-red-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'low': return 'text-green-400 bg-green-500/20';
      default: return 'text-blue-400 bg-blue-500/20';
    }
  };

  const isToday = (dateString) => {
    const today = new Date().toISOString().split('T')[0];
    return dateString === today;
  };

  const isOverdue = (dateString, timeString) => {
    const today = new Date().toISOString().split('T')[0];
    if (dateString < today) return true;
    if (dateString === today) {
      const now = new Date();
      const reminderTime = new Date(`${dateString}T${timeString}`);
      return now > reminderTime;
    }
    return false;
  };

  const filteredReminders = reminders.filter(reminder => {
    if (filterStatus === 'completed') return reminder.completed;
    if (filterStatus === 'active') return !reminder.completed;
    if (filterStatus === 'today') return isToday(reminder.date) && !reminder.completed;
    if (filterStatus === 'overdue') return isOverdue(reminder.date, reminder.time) && !reminder.completed;
    return true;
  });

  const sortedReminders = [...filteredReminders].sort((a, b) => {
    if (a.date !== b.date) return new Date(a.date) - new Date(b.date);
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (a.priority !== b.priority) return priorityOrder[a.priority] - priorityOrder[b.priority];
    return a.time.localeCompare(b.time);
  });

  const groupedReminders = sortedReminders.reduce((groups, reminder) => {
    const date = reminder.date;
    if (!groups[date]) groups[date] = [];
    groups[date].push(reminder);
    return groups;
  }, {});

  const formatDate = (dateString) => {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', options);
  };

  const calculateComplianceReport = () => {
    const now = new Date();
    const startDate = new Date();
    if (reportType === 'weekly') {
      startDate.setDate(now.getDate() - 7);
    } else {
      startDate.setMonth(now.getMonth() - 1);
    }
    const periodStart = startDate.toISOString().split('T')[0];

    const relevantReminders = reminders.filter(r => r.date >= periodStart);
    const totalReminders = relevantReminders.length;
    const takenReminders = relevantReminders.filter(r => r.completed).length;
    const complianceRate = totalReminders > 0 ? (takenReminders / totalReminders * 100).toFixed(1) : 0;

    const medicationStats = {};
    relevantReminders.forEach(r => {
      if (r.medication) {
        if (!medicationStats[r.medication]) {
          medicationStats[r.medication] = { total: 0, taken: 0 };
        }
        medicationStats[r.medication].total += 1;
        if (r.completed) medicationStats[r.medication].taken += 1;
      }
    });

    return { complianceRate, medicationStats, periodStart, totalReminders, takenReminders };
  };

  const { complianceRate, medicationStats, periodStart, totalReminders, takenReminders } = calculateComplianceReport();

  return (
    <div className="bg-gradient-to-br from-gray-900 via-slate-900 to-black text-white min-h-screen flex">
      <audio ref={notificationAudioRef} preload="auto">
        <source src="/notification-sound.mp3" type="audio/mpeg" />
        <source
          src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLHPR+N2fXBtBhtDeyJplNnOw0K9/WDdjrdBzRDhnsMJ0HrC/cTgZrOuhMwO00zoNDrLJTBoP3OdAFaDN+LhrCo9YqDQkW1QsMU99pPm4Y7qz3ofgbgDgcPvQDuuIDvBQ6dE/+68WrkEbrE4n4U9huFBHU8TtoOGRgYl7yrXBmpJySE6egcfq36lPPEVYlsr93LJkR1CLpNv/0LFkQ0V/oN0EzblXNjpcf8UHyK9PLSpDftEWw6ZhPRg3b9kdvZtnUSsqX+MqroJnbUEkTOk4pX1qfVQkQu1DnoFpiFcdN+9Sm4JphWAVKO9gnH9kj2cTH+xoq3ZdkHIQFetvt2lOlYsNDOhpxFw9oKUFBOdpz1MurK4CAOhp01ATuMsAANxk1k0IxuMBANJY0UcC0vYFAMVMyjsA3w0KFsBEuiQHAAbMLrMXxTl9CrwMY0sE8qqQ4irDgVgdrwu1nA5rvIQw2w2hog96oHAnHQnk0BgTu3yPLSgNFLU7McNvljE9ER7SRC/FVtIzUxMq6GMwu0TkM18POvxoLrAsEDSDEkURcCsmkvEdVkYaEpdOHhIcxhIYQVQQkFwbD1faDxgyZw0r"
          type="audio/wav"
        />
      </audio>

      {showNotification && activeNotification && (
        <div className="fixed top-6 right-6 z-50 max-w-sm w-full bg-gray-800 rounded-xl border border-purple-500/30 shadow-2xl shadow-purple-500/20 p-4 backdrop-blur-xl transition-all duration-300 animate-slide-in">
          <div className="flex items-start">
            <div className="flex-shrink-0 mt-0.5">
              <div className="bg-purple-500/20 rounded-full p-2">
                <Bell className="w-6 h-6 text-purple-400" />
              </div>
            </div>
            <div className="ml-3 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-100">Medication Reminder</p>
                <button
                  type="button"
                  className="rounded-md bg-gray-800 text-gray-400 hover:text-gray-200"
                  onClick={dismissNotification}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-1">
                <p className="text-sm text-gray-300">
                  Time to take {activeNotification.medication || activeNotification.title}
                </p>
                {activeNotification.description && (
                  <p className="mt-1 text-xs text-gray-400">{activeNotification.description}</p>
                )}
                <div className="mt-3 flex space-x-2">
                  <button
                    type="button"
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none"
                    onClick={() => handleMarkTaken(activeNotification.id)}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Mark as Taken
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center px-3 py-1.5 border border-gray-600 text-xs font-medium rounded-full shadow-sm text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none"
                    onClick={dismissNotification}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`fixed inset-y-0 left-0 z-10 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} />
      </div>

      <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-0'} overflow-hidden`}>
        <div className="min-h-screen flex flex-col">
          <div className="p-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-2">Medication Reminders</h1>
                <p className="text-gray-400 text-sm tracking-wide">Manage your medication schedule and stay on track</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <button
                    className="flex items-center bg-gray-800/60 backdrop-blur-lg text-white px-4 py-2 rounded-full border border-gray-700/30 hover:bg-gray-700/60 transition-colors"
                    onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    {filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </button>
                  {isFilterDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-xl shadow-lg z-10 overflow-hidden border border-gray-700/50">
                      <div className="py-2 px-4 hover:bg-gray-700 cursor-pointer" onClick={() => { setFilterStatus('all'); setIsFilterDropdownOpen(false); }}>All</div>
                      <div className="py-2 px-4 hover:bg-gray-700 cursor-pointer" onClick={() => { setFilterStatus('today'); setIsFilterDropdownOpen(false); }}>Today</div>
                      <div className="py-2 px-4 hover:bg-gray-700 cursor-pointer" onClick={() => { setFilterStatus('active'); setIsFilterDropdownOpen(false); }}>Active</div>
                      <div className="py-2 px-4 hover:bg-gray-700 cursor-pointer" onClick={() => { setFilterStatus('completed'); setIsFilterDropdownOpen(false); }}>Completed</div>
                      <div className="py-2 px-4 hover:bg-gray-700 cursor-pointer" onClick={() => { setFilterStatus('overdue'); setIsFilterDropdownOpen(false); }}>Overdue</div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowReport(true)}
                  className="bg-gray-800/60 text-white px-4 py-2 rounded-full hover:bg-gray-700/60 transition-colors flex items-center"
                >
                  <TrendingUp className="w-5 h-5 mr-2" />
                  View Report
                </button>
                <button
                  onClick={() => setShowAddReminder(true)}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2 rounded-full hover:scale-105 transition-transform shadow-lg flex items-center"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Reminder
                </button>
                <button
                  onClick={() => setShowPharmacies(!showPharmacies)}
                  className={`flex items-center px-4 py-2 rounded-full border transition-colors ${
                    showPharmacies
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-gray-800/60 text-gray-300 border-gray-700/30 hover:bg-gray-700/60'
                  }`}
                >
                  <MapPin className="w-5 h-5 mr-2" />
                  {showPharmacies ? 'Hide Nearby Pharmacies' : 'Show Nearby Pharmacies'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-1 px-8 pb-8 overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {showPharmacies && (
                <div className="mb-8">
                  <div className="flex items-center mb-4">
                    <MapPin className="w-5 h-5 text-purple-400 mr-2" />
                    <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">Nearby Pharmacies</h3>
                  </div>
                  <div className="bg-gray-800/60 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/30 shadow-xl">
                    {isLoadingPharmacies ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
                        <span className="ml-3 text-gray-400">Loading pharmacies...</span>
                      </div>
                    ) : locationError ? (
                      <div className="flex flex-col items-center justify-center py-6 px-4">
                        <AlertCircle className="w-8 h-8 text-red-400 mr-3 mb-2" />
                        <p className="text-red-400 text-center">{locationError}</p>
                        <button
                          onClick={() => setShowPharmacies(false)}
                          className="mt-4 bg-purple-500/20 text-purple-400 px-4 py-2 rounded-full text-sm hover:bg-purple-500/30 transition-colors"
                        >
                          Close
                        </button>
                      </div>
                    ) : pharmacies.length > 0 ? (
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pharmacies.map((pharmacy) => (
                          <li
                            key={pharmacy.id || pharmacy.name}
                            className="bg-gray-800/80 rounded-xl p-4 border border-purple-500/10 hover:border-purple-500/20 transition-all shadow-md hover:shadow-purple-500/5"
                          >
                            <div className="flex items-start">
                              <div className="bg-purple-500/10 rounded-full p-2 mr-3">
                                <MapPin className="w-5 h-5 text-purple-400" />
                              </div>
                              <div className="flex-1">
                                <h4 className="text-white font-semibold mb-1">{pharmacy.name || 'Unknown Pharmacy'}</h4>
                                <p className="text-gray-400 text-sm">{pharmacy.address || 'No address available'}</p>
                                <div className="flex mt-2 items-center">
                                  <Clock className="w-3 h-3 text-gray-500 mr-1" />
                                  <span className="text-xs text-gray-500">{pharmacy.hours || 'Opens 9 AM - 9 PM'}</span>
                                  <span className="mx-2 text-gray-600">•</span>
                                  <span className="text-xs text-green-400">{pharmacy.status || 'Open Now'}</span>
                                </div>
                                <div className="mt-3 flex space-x-2">
                                  <button className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors">
                                    <Phone className="w-3 h-3 mr-1" /> Call
                                  </button>
                                  <a
                                    href={getDirectionsUrl(pharmacy)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                                    onClick={(e) => {
                                      if (!userLocation) {
                                        e.preventDefault();
                                        alert('Location unavailable. Please enable location services.');
                                      }
                                    }}
                                  >
                                    <Navigation className="w-3 h-3 mr-1" /> Directions
                                  </a>
                                </div>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8">
                        <MapPin className="w-16 h-16 text-gray-600 mb-4" />
                        <p className="text-gray-400 text-center">No pharmacies found nearby.</p>
                        <button
                          onClick={() => setShowPharmacies(false)}
                          className="mt-4 bg-purple-500/20 text-purple-400 px-4 py-2 rounded-full text-sm hover:bg-purple-500/30 transition-colors"
                        >
                          Close
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <Bell className="w-6 h-6 text-purple-400 mr-2" />
                  <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                    Your Reminders
                  </h2>
                </div>
                <div className="bg-gray-800/60 backdrop-blur-xl px-4 py-2 rounded-full border border-gray-700/30">
                  <span className="text-gray-400 mr-2">Today:</span>
                  <span className="text-white font-bold">{reminders.filter(r => isToday(r.date) && !r.completed).length}</span>
                  <span className="text-gray-400 mx-2">|</span>
                  <span className="text-gray-400 mr-2">Total:</span>
                  <span className="text-white font-bold">{reminders.filter(r => !r.completed).length}</span>
                </div>
              </div>

              {Object.keys(groupedReminders).length > 0 ? (
                Object.entries(groupedReminders).map(([date, dateReminders]) => (
                  <div key={date} className="mb-8">
                    <div className="flex items-center mb-4">
                      <Calendar className="w-5 h-5 text-gray-400 mr-2" />
                      <h3 className={`text-xl font-semibold ${isToday(date) ? 'text-purple-400' : 'text-gray-300'}`}>
                        {isToday(date) ? 'Today' : formatDate(date)}
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {dateReminders.map((reminder) => (
                        <div
                          key={reminder.id}
                          className={`bg-gray-800/60 backdrop-blur-xl rounded-2xl p-4 border border-gray-700/30 shadow-xl transition-all ${
                            reminder.completed ? 'opacity-60' : 'hover:shadow-purple-900/10'
                          }`}
                        >
                          <div className="flex items-start">
                            <button
                              onClick={() => handleToggleComplete(reminder.id)}
                              className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 mt-1 transition-colors ${
                                reminder.completed
                                  ? 'bg-purple-500 border-purple-600'
                                  : `border-${getPriorityColor(reminder.priority).split(' ')[0]}`
                              }`}
                            >
                              {reminder.completed && <Check className="w-4 h-4 text-white" />}
                            </button>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className={`font-semibold text-lg ${reminder.completed ? 'line-through text-gray-500' : 'text-white'}`}>
                                  {reminder.title}
                                </h4>
                                <div className="flex items-center space-x-2">
                                  {isOverdue(reminder.date, reminder.time) && !reminder.completed && (
                                    <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">
                                      Overdue
                                    </span>
                                  )}
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(reminder.priority)}`}>
                                    {reminder.priority?.charAt(0).toUpperCase() + reminder.priority?.slice(1) || "No Priority"}
                                  </span>
                                  {reminder.recurring !== 'none' && (
                                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium flex items-center">
                                      <Repeat className="w-3 h-3 mr-1" />
                                      {reminder.recurring?.charAt(0).toUpperCase() + reminder.recurring?.slice(1) || "Not Recurring"}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {reminder.medication && (
                                <div className="flex items-center text-sm text-gray-400 mb-2">
                                  <Pill className="w-4 h-4 mr-1 text-purple-400" />
                                  {reminder.medication}
                                </div>
                              )}
                              {reminder.description && (
                                <p className="text-gray-400 text-sm mb-3">{reminder.description}</p>
                              )}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center text-sm">
                                  <Clock className="w-4 h-4 mr-1 text-gray-500" />
                                  <span className={`${reminder.completed ? 'text-gray-500' : 'text-gray-300'}`}>
                                    {reminder.time}
                                  </span>
                                </div>
                                <div className="flex space-x-2">
                                  {!reminder.completed && (
                                    <button
                                      onClick={() => handleMarkTaken(reminder.id)}
                                      className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm hover:bg-green-500/30 transition-colors"
                                    >
                                      Mark Taken
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteReminder(reminder.id)}
                                    className="text-gray-500 hover:text-red-400 transition-colors p-1"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-64 bg-gray-800/40 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/30">
                  <Bell className="w-16 h-16 text-gray-600 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-400 mb-2">No reminders found</h3>
                  <p className="text-gray-500 text-sm mb-4">Upload a prescription or add a reminder manually to get started.</p>
                  <button
                    onClick={() => setShowAddReminder(true)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2 rounded-full hover:scale-105 transition-transform shadow-lg flex items-center"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Reminder
                  </button>
                </div>
              )}
            </div>

            <div className="w-80 flex-shrink-0 pl-6">
              <div className="sticky top-0 pt-8">
                <div className="bg-gray-800/60 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/30 shadow-xl mb-6">
                  <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-4">
                    Upcoming Reminders
                  </h3>
                  {reminders.filter(r => !r.completed && new Date(`${r.date}T${r.time}`) > new Date()).length > 0 ? (
                    <ul className="space-y-3">
                      {reminders
                        .filter(r => !r.completed && new Date(`${r.date}T${r.time}`) > new Date())
                        .sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`))
                        .slice(0, 5)
                        .map(reminder => (
                          <li key={reminder.id} className="flex items-center">
                            <span className={`w-2 h-2 rounded-full mr-2 ${getPriorityColor(reminder.priority).split(' ')[0]}`}></span>
                            <div>
                              <div className="text-gray-300 font-medium">{reminder.title}</div>
                              <div className="text-gray-500 text-xs">{reminder.time} - {formatDate(reminder.date)}</div>
                            </div>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400 text-sm">No upcoming reminders.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {showAddReminder && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full border border-gray-700/50 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                  Add New Reminder
                </h3>
                <button
                  onClick={handleCancelAdd}
                  className="p-2 hover:bg-gray-700/50 rounded-full"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Title</label>
                  <input
                    type="text"
                    value={newReminder.title}
                    onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
                    className="w-full bg-gray-700/60 border border-gray-600/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    placeholder="Take medication"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Medication (Optional)</label>
                  <select
                    value={newReminder.medication}
                    onChange={(e) => setNewReminder({ ...newReminder, medication: e.target.value })}
                    className="w-full bg-gray-700/60 border border-gray-600/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  >
                    <option value="">Select a medication</option>
                    {medicationData.map(med => (
                      <option key={med.id} value={med.name}>{med.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Description (Optional)</label>
                  <textarea
                    value={newReminder.description}
                    onChange={(e) => setNewReminder({ ...newReminder, description: e.target.value })}
                    className="w-full bg-gray-700/60 border border-gray-600/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    placeholder="Additional notes"
                    rows="2"
                  ></textarea>
                </div>
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <label className="block text-gray-400 text-sm mb-1">Time</label>
                    <input
                      type="time"
                      value={newReminder.time}
                      onChange={(e) => setNewReminder({ ...newReminder, time: e.target.value })}
                      className="w-full bg-gray-700/60 border border-gray-600/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-gray-400 text-sm mb-1">Date</label>
                    <input
                      type="date"
                      value={newReminder.date}
                      onChange={(e) => setNewReminder({ ...newReminder, date: e.target.value })}
                      className="w-full bg-gray-700/60 border border-gray-600/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Priority</label>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      className={`flex-1 py-2 px-4 rounded-lg text-sm ${newReminder.priority === 'low' ? 'bg-green-500/30 text-green-400 border border-green-500/30' : 'bg-gray-700/60 text-gray-400 border border-gray-600/50'}`}
                      onClick={() => setNewReminder({ ...newReminder, priority: 'low' })}
                    >
                      Low
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-2 px-4 rounded-lg text-sm ${newReminder.priority === 'medium' ? 'bg-yellow-500/30 text-yellow-400 border border-yellow-500/30' : 'bg-gray-700/60 text-gray-400 border border-gray-600/50'}`}
                      onClick={() => setNewReminder({ ...newReminder, priority: 'medium' })}
                    >
                      Medium
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-2 px-4 rounded-lg text-sm ${newReminder.priority === 'high' ? 'bg-red-500/30 text-red-400 border border-red-500/30' : 'bg-gray-700/60 text-gray-400 border border-gray-600/50'}`}
                      onClick={() => setNewReminder({ ...newReminder, priority: 'high' })}
                    >
                      High
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Recurring</label>
                  <select
                    value={newReminder.recurring}
                    onChange={(e) => setNewReminder({ ...newReminder, recurring: e.target.value })}
                    className="w-full bg-gray-700/60 border border-gray-600/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  >
                    <option value="none">Not recurring</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div className="pt-4 flex justify-end space-x-3">
                  <button
                    onClick={handleCancelAdd}
                    className="px-4 py-2 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddReminder}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-colors"
                    disabled={!newReminder.title || !newReminder.time}
                  >
                    Add Reminder
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showReport && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto border border-gray-700/50 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                  Medication Compliance Report
                </h3>
                <button
                  onClick={() => setShowReport(false)}
                  className="p-2 hover:bg-gray-700/50 rounded-full"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="flex items-center mb-6">
                <button
                  className={`px-4 py-2 rounded-lg text-sm mr-3 ${reportType === 'weekly' ? 'bg-purple-500/30 text-purple-400 border border-purple-500/30' : 'bg-gray-700/60 text-gray-400 border border-gray-600/50'}`}
                  onClick={() => setReportType('weekly')}
                >
                  Last 7 Days
                </button>
                <button
                  className={`px-4 py-2 rounded-lg text-sm ${reportType === 'monthly' ? 'bg-purple-500/30 text-purple-400 border border-purple-500/30' : 'bg-gray-700/60 text-gray-400 border border-gray-600/50'}`}
                  onClick={() => setReportType('monthly')}
                >
                  Last 30 Days
                </button>
              </div>
              <div className="bg-gray-700/50 rounded-xl p-6 mb-6">
                <div className="text-center">
                  <h4 className="text-lg text-gray-300 mb-1">Overall Compliance Rate</h4>
                  <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-2">
                    {complianceRate}%
                  </div>
                  <p className="text-gray-400 text-sm">
                    {takenReminders} of {totalReminders} reminders taken
                  </p>
                </div>
              </div>
              <div>
                <h4 className="text-lg text-gray-300 mb-4">Medication Breakdown</h4>
                {Object.keys(medicationStats).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(medicationStats).map(([med, stats]) => (
                      <div key={med} className="bg-gray-700/30 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <h5 className="font-medium text-gray-200">{med}</h5>
                          <span className="text-sm text-gray-400">
                            {stats.taken} of {stats.total} doses taken
                          </span>
                        </div>
                        <div className="relative pt-1">
                          <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-600">
                            <div
                              style={{ width: `${(stats.taken / stats.total) * 100}%` }}
                              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-purple-500 to-pink-500"
                            ></div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-700/30 rounded-lg p-6 text-center">
                    <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-400">No medication data available for this period</p>
                  </div>
                )}
              </div>
              <div className="pt-6 flex justify-end">
                <button
                  onClick={() => setShowReport(false)}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-colors"
                >
                  Close Report
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reminders;