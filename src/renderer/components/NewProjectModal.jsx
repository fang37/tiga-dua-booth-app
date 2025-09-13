import React, { useState, useEffect } from 'react';

// Helper to get today's date in YYYY-MM-DD format
const getTodayString = () => new Date().toISOString().split('T')[0];

function NewProjectModal({ isOpen, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(getTodayString()); // 1. Add state for the date

  useEffect(() => {
    // Reset fields when the modal opens
    if (isOpen) {
      setName('');
      setDate(getTodayString());
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = () => {
    if (name && date) {
      onSubmit({ name, date }); // 2. Pass both name and date on submit
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Create New Project</h2>
        <p>Enter a name and date for the new project.</p>
        <label htmlFor="projectName">Project Name</label>
        <input
          id="projectName"
          type="text"
          className="modal-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Maria & David's Wedding"
          autoFocus
        />
        <label htmlFor="projectDate">Event Date</label>
        <input
          id="projectDate"
          type="date" // 3. Add the date input field
          className="modal-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit}>Create</button>
        </div>
      </div>
    </div>
  );
}

export default NewProjectModal;