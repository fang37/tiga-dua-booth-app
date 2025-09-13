import React, { useState, useEffect } from 'react';
import CropModal from './CropModal';

const TEMPLATES = {
  '2x2': { 
    count: 4, 
    className: 'grid-2x2', 
    cropAspectRatio: 1 / 1,      // Cells are square
    gridAspectRatio: '1 / 1',      // The whole grid is a square
  },
  '1x4': { 
    count: 4, 
    className: 'grid-1x4', 
    cropAspectRatio: 4 / 1.5,   // Each cell is a thin portrait rectangle
    gridAspectRatio: '4 / 6',      // The whole grid is a 4x6 print
  },
  '1x2': { 
    count: 2, 
    className: 'grid-1x2', 
    cropAspectRatio: 4 / 3,      // Each cell is a 4x3 portrait
    gridAspectRatio: '4 / 6',      // The whole grid is a 4x6 print
  },
};

function GridCreator({ customer, projectId, onBack }) {
  const [editedPhotos, setEditedPhotos] = useState([]);
  const [project, setProject] = useState(null);
  const [templateKey, setTemplateKey] = useState('2x2');
  const [gridSlots, setGridSlots] = useState(Array(TEMPLATES[templateKey].count).fill(null));
  const [cropImage, setCropImage] = useState(null);

  const [firstSelectedIndex, setFirstSelectedIndex] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      if (customer) {
        const projectDetails = await window.api.getProjectById(projectId);
        setProject(projectDetails);
        const photos = await window.api.getEditedPhotos(customer.id);
        setEditedPhotos(photos);
      }
    };
    loadData();

    window.api.onNewEditedPhoto((filePath) => {
      setEditedPhotos(prev => [...prev, filePath]);
    });
  }, [projectId, customer]);

  const handleSelectTemplate = (key) => {
    setTemplateKey(key);
    setGridSlots(Array(TEMPLATES[key].count).fill(null)); // Reset grid
  };

  const handleOpenCropper = (photoPath, gridIndex = null) => {
    setCropImage({ path: photoPath, index: gridIndex });
  };

  const handleCropComplete = async (croppedImageData) => {
    if (!project) return;

    const result = await window.api.saveCroppedImage({
      projectPath: project.folder_path,
      imageData: croppedImageData
    });

    if (result.success) {
      const newSlots = [...gridSlots];
      if (cropImage.index !== null) {
        // Re-cropping an image already in a slot
        newSlots[cropImage.index] = result.filePath;
      } else {
        // Cropping a new image for the next empty slot
        const nextEmptySlot = newSlots.findIndex(slot => slot === null);
        if (nextEmptySlot !== -1) newSlots[nextEmptySlot] = result.filePath;
      }
      setGridSlots(newSlots);
    }
    setCropImage(null); // Close modal
  };

   const handleDeleteFromSlot = (indexToDelete) => {
    const newSlots = [...gridSlots];
    newSlots[indexToDelete] = null; 
    setGridSlots(newSlots);
  };

  const handleGridCellClick = (index) => {
    if (gridSlots[index]) {
      if (firstSelectedIndex === null) {
        setFirstSelectedIndex(index);
      } else {
        const newSlots = [...gridSlots];
        [newSlots[firstSelectedIndex], newSlots[index]] = [newSlots[index], newSlots[firstSelectedIndex]];
        setGridSlots(newSlots);
        setFirstSelectedIndex(null);
      }
    } else {
      if (firstSelectedIndex !== null) {
        const newSlots = [...gridSlots];
        newSlots[index] = newSlots[firstSelectedIndex];
        newSlots[firstSelectedIndex] = null;
        setGridSlots(newSlots);
        setFirstSelectedIndex(null);
      }
    }
  };

  return (

    <div className="grid-creator-container">
      <CropModal
        imageSrc={cropImage?.path}
        onClose={() => setCropImage(null)}
        onCrop={handleCropComplete}
        aspectRatio={TEMPLATES[templateKey].cropAspectRatio}
      />

      <div className="grid-toolbar">
        <button className="btn-secondary back-btn" onClick={onBack}>&larr; Back to Workspace</button>
        <h3>Edited Photos</h3>
        <div className="edited-photo-list">
          {editedPhotos.map((photo) => (
            <div
              key={photo}
              className="edited-thumbnail"
              onClick={() => handleOpenCropper(photo)}
            >
              <img src={`file://${photo}`} alt="Edited thumbnail" />
            </div>
          ))}
        </div>
        <h3>Grid Templates</h3>
        <div className="template-buttons">
          {Object.keys(TEMPLATES).map(key => (
            <button key={key} className="btn-secondary" onClick={() => handleSelectTemplate(key)}>{key}</button>
          ))}
        </div>
        <button className="btn-primary">Export Final Image</button>
      </div>

      <div className="grid-canvas">
        <div className={`grid-preview ${TEMPLATES[templateKey].className}`}
        style={{ aspectRatio: TEMPLATES[templateKey].gridAspectRatio }}
        >
          {gridSlots.map((photoPath, index) => (
            <div
              key={index}
              className={`grid-cell ${firstSelectedIndex === index ? 'selected-for-swap' : ''}`}
              onClick={() => handleGridCellClick(index)}
              onDoubleClick={() => photoPath && handleOpenCropper(photoPath, index)}
            >
               {photoPath ? (
                <>
                  <img src={`file://${photoPath}`} alt={`Slot ${index + 1}`} />
                  <button 
                    className="btn-delete-slot" 
                    onClick={(e) => {
                      e.stopPropagation(); 
                      handleDeleteFromSlot(index);
                    }}
                  >
                    &times;
                  </button>
                </>
              ) : (
                <p>+</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>

  );
}

export default GridCreator;