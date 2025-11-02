import React, { useState } from 'react';

function PrintCopiesModal({ isOpen, onClose, onSubmit }) {
  const [quantity, setQuantity] = useState(1);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (quantity > 0) {
      onSubmit(quantity);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Add to Print Queue</h2>
        <p>How many copies would you like to print?</p>
        
        <label htmlFor="quantity">Quantity</label>
        <input
          id="quantity"
          type="number"
          className="modal-input"
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
          min="1"
          autoFocus
        />
        
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit}>Add to Queue</button>
        </div>
      </div>
    </div>
  );
}

export default PrintCopiesModal;