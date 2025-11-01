import React, { createContext, useContext, useState, useCallback } from 'react';
import Notification from './Notification';

// 1. Create the context
const NotificationContext = createContext(null);

// 2. Create the Provider component
export function NotificationProvider({ children }) {
  const [notification, setNotification] = useState(null); // { msg, type } or null

  // The function that other components will call
  const showNotification = useCallback((msg, type = 'info') => {
    setNotification({ msg, type });
  }, []);

  const closeNotification = () => {
    setNotification(null);
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      <Notification 
        message={notification?.msg} 
        type={notification?.type} 
        onClose={closeNotification} 
      />
    </NotificationContext.Provider>
  );
}

// 3. Create a custom hook for easy access
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
