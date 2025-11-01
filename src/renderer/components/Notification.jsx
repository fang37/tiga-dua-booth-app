import React, { useEffect } from 'react';

function Notification({ message, type = 'info', onClose }) {
  useEffect(() => {
    if (message) {
      // Automatically close the notification after 3.5 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  // Use the 'type' prop to set the CSS class
  return (
    <div className={`notification ${type}`}>
      <p>{message}</p>
      <button onClick={onClose}>&times;</button>
    </div>
  );
}

export default Notification;
