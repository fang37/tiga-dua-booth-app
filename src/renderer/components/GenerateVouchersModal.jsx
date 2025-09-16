import React, { useState } from 'react';

function GenerateVouchersModal({ project, onClose, onGenerate }) {
  const [quantity, setQuantity] = useState(100);

  if (!project) return null;

  const handleGenerate = () => {
    if (quantity > 0) {
      onGenerate(project.id, quantity);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Generate Vouchers for "{project.name}"</h2>
        <p>How many vouchers would you like to create for this project?</p>
        <label htmlFor="quantity">Quantity</label>
        <input
          id="quantity"
          type="number"
          className="modal-input"
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
          autoFocus
        />
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleGenerate}>Generate</button>
        </div>
      </div>
    </div>
  );
}

export default GenerateVouchersModal;