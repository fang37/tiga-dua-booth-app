import React, { useState, useRef } from 'react'; // 1. Remove useState, we only need useRef
import Cropper from 'react-cropper';
import 'cropperjs/dist/cropper.css';

function CropModal({ imageSrc, onClose, onCrop, aspectRatio }) {
  const cropperRef = useRef(null);
  const [rotation, setRotation] = useState(0);

  if (!imageSrc) return null;

  const getCropData = () => {
    const cropper = cropperRef.current?.cropper;
    if (typeof cropper !== 'undefined') {
      const croppedData = cropper.getCroppedCanvas().toDataURL('image/jpeg');
      onCrop(croppedData);
    }
  };

  const handleRotationChange = (e) => {
    const newRotation = parseInt(e.target.value, 10);
    setRotation(newRotation);
    cropperRef.current?.cropper.rotateTo(newRotation);
  };

  const handleRotate90 = () => {
    const newRotation = (rotation + 90) % 360;
    setRotation(newRotation);
    cropperRef.current?.cropper.rotateTo(newRotation);
  };


  return (
    <div className="modal-overlay">
      <div className="modal-content large">
        <h2>Crop Image</h2>
        <div className="cropper-container">
          <Cropper
            ref={cropperRef}
            src={imageSrc.base64Data}
            style={{ height: 400, width: '100%' }}
            aspectRatio={aspectRatio}
            viewMode={1}
            dragMode={'move'}
            guides={false}
          />
        </div>

        <div className="rotation-control">
          <label htmlFor="rotation">Rotate: {rotation}°</label>
          <input
            id="rotation"
            type="range"
            min="-45"
            max="45"
            value={rotation}
            onChange={handleRotationChange}
            className="rotation-slider"
          />
        </div>

        <div className="modal-actions">
          <button className="btn-secondary rotate-btn" onClick={handleRotate90}>Rotate ↻</button>
          <div className="modal-actions-right">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={getCropData}>Crop</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CropModal;