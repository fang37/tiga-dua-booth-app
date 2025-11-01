import React, { useState, useEffect } from 'react';
import CropModal from './CropModal';

// const TEMPLATES = {
//   '2x2': { 
//     count: 4, 
//     className: 'grid-2x2', 
//     cropAspectRatio: 1 / 1,      // Cells are square
//     gridAspectRatio: '1 / 1',      // The whole grid is a square
//   },
//   '1x4': { 
//     count: 4, 
//     className: 'grid-1x4', 
//     cropAspectRatio: 4 / 1.5,   // Each cell is a thin portrait rectangle
//     gridAspectRatio: '4 / 6',      // The whole grid is a 4x6 print
//   },
//   '1x2': { 
//     count: 2, 
//     className: 'grid-1x2', 
//     cropAspectRatio: 4 / 3,      // Each cell is a 4x3 portrait
//     gridAspectRatio: '4 / 6',      // The whole grid is a 4x6 print
//   },
// };

function GridCreator({ customer, projectId, onBack }) {
  const [editedPhotos, setEditedPhotos] = useState([]);
  const [project, setProject] = useState(null);

  // State to hold the templates available for this specific project
  const [availableTemplates, setAvailableTemplates] = useState([]);
  // State to hold the currently selected template object
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // const [templateKey, setTemplateKey] = useState('2x2');
  const [gridSlots, setGridSlots] = useState([]);
  const [cropImage, setCropImage] = useState(null);
  const [firstSelectedIndex, setFirstSelectedIndex] = useState(null);

  const [overlayPreviewData, setOverlayPreviewData] = useState(null);
  const [watermarkPreviewData, setWatermarkPreviewData] = useState(null);

  const loadData = async () => {
    if (customer) {
      const projectDetails = await window.api.getProjectById(projectId);
      setProject(projectDetails);

      const photoPaths = await window.api.getEditedPhotos(customer.id);
      // Fetch Base64 data for each edited photo
      const photosWithData = await Promise.all(
        photoPaths.map(async (path) => ({
          originalPath: path,
          base64Data: await window.api.getProjectFileAsBase64(path)
        }))
      );
      setEditedPhotos(photosWithData);
    }

    // Fetch only the templates enabled for this project
    const templatesForProject = await window.api.getTemplatesForProject(projectId);
    const enabledTemplates = templatesForProject.filter(tpl => tpl.checked == 1);
    setAvailableTemplates(enabledTemplates);

    // If there are available templates, select the first one by default
    if (enabledTemplates.length > 0 && !selectedTemplate) {
      handleSelectTemplate(enabledTemplates[0]);
    }
  };

  useEffect(() => {
    if (customer) {
      loadData();
    }

    window.api.onNewEditedPhoto((filePath) => {
      setEditedPhotos(prev => [...prev, filePath]);
    });
  }, [projectId, customer]);

  const handleSelectTemplate = async (template) => {
    setSelectedTemplate(template);
    const config = JSON.parse(template.layout_config);
    setGridSlots(Array(config.rows * config.cols).fill(null));
    setFirstSelectedIndex(null);

    // Fetch the overlay Base64 data when a template is selected
    if (template.overlay_image_path) {
      const data = await window.api.getUserDataFileAsBase64(template.overlay_image_path);
      setOverlayPreviewData(data);
    } else {
      setOverlayPreviewData(null);
    }

    if (config.watermark?.path) {
      const data = await window.api.getUserDataFileAsBase64(config.watermark.path);
      setWatermarkPreviewData(data);
    } else {
      setWatermarkPreviewData(null);
    }
  };

  const getLayoutConfig = () => {
    if (!selectedTemplate || !selectedTemplate.layout_config) {
      return null;
    }
    return JSON.parse(selectedTemplate.layout_config);
  };

  const getBackgroundColorConfig = () => {
    if (!selectedTemplate || !selectedTemplate.background_color) {
      return null;
    }
    return selectedTemplate.background_color;
  };

  const handleOpenCropper = async (photoPath, gridIndex = null) => {
    const base64Data = await window.api.getProjectFileAsBase64(photoPath);
    if (base64Data) {
      setCropImage({
        path: photoPath, // Keep the original path for saving
        base64Data: base64Data,    // The data for the cropper to display
        index: gridIndex
      });
    }
  };

  const handleCropComplete = async (croppedImageData) => {
    if (!project) return;

    const result = await window.api.saveCroppedImage({
      projectPath: project.folder_path,
      imageData: croppedImageData
    });

    if (result.success) {
      const newSlots = [...gridSlots];
      const newSlotData = {
        originalPath: cropImage.path,
        croppedPath: result.filePath,
        base64Data: croppedImageData,
      };
      if (cropImage.index !== null) {
        // Re-cropping an image already in a slot
        newSlots[cropImage.index] = newSlotData;
      } else {
        // Cropping a new image for the next empty slot
        const nextEmptySlot = newSlots.findIndex(slot => slot === null);
        if (nextEmptySlot !== -1) newSlots[nextEmptySlot] = newSlotData;
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

  const layoutConfig = getLayoutConfig();
  const backgroundColor = getBackgroundColorConfig();
  let previewStyle = {};
  let watermarkPreviewStyle = {};
  let scale = 1;

  if (layoutConfig) {
    const PREVIEW_MAX_SIZE = 450;
    scale = Math.min(PREVIEW_MAX_SIZE / layoutConfig.print_width_mm, PREVIEW_MAX_SIZE / layoutConfig.print_height_mm);

    previewStyle = {
      width: `${layoutConfig.print_width_mm * scale}px`,
      height: `${layoutConfig.print_height_mm * scale}px`,
      backgroundColor: backgroundColor,
      padding: `${layoutConfig.padding_mm.top * scale}px ${layoutConfig.padding_mm.right * scale}px ${layoutConfig.padding_mm.bottom * scale}px ${layoutConfig.padding_mm.left * scale}px`,
      gap: `${layoutConfig.gap_mm * scale}px`,
      display: 'grid',
      gridTemplateColumns: `repeat(${layoutConfig.cols}, 1fr)`,
      gridTemplateRows: `repeat(${layoutConfig.rows}, 1fr)`,
    };

    if (layoutConfig.watermark && layoutConfig.watermark.path) {
      watermarkPreviewStyle = {
        position: 'absolute',
        opacity: layoutConfig.watermark.opacity,
        width: `${layoutConfig.watermark.size}%`,
        left: `${layoutConfig.watermark.position.x}%`,
        top: `${layoutConfig.watermark.position.y}%`,
        transform: 'translate(-50%, -50%)',
      };
    }
  }

  const handleExport = async () => {
    // Check if there's a template and project selected
    if (!selectedTemplate || !project) {
      alert('Please select a template first.');
      return;
    }
    // Check if the grid has at least one photo
    if (gridSlots.every(slot => slot === null)) {
      alert('Please add at least one photo to the grid.');
      return;
    }

    const result = await window.api.exportGridImage({
      projectPath: project.folder_path,
      imagePaths: gridSlots,
      template: selectedTemplate,
      customerId: customer.id
    });

    if (result.success) {
      await window.api.updateVoucherStatus({ voucherId: customer.voucherId, status: 'exported' });
      alert(`Grid successfully exported!`);
    } else {
      alert(`Error exporting grid: ${result.error}`);
    }
  };

  return (

    <div className="grid-creator-container">
      <CropModal
        imageSrc={cropImage}
        onClose={() => setCropImage(null)}
        onCrop={handleCropComplete}
        aspectRatio={layoutConfig?.crop_aspect_ratio}
      />

      <div className="grid-toolbar">
        <button className="btn-secondary back-btn" onClick={onBack}>&larr; Back to Workspace</button>
        <div className="panel-header">
          <h3>Edited Photos</h3>
          <div>
            <button className="btn-icon" title="Refresh List" onClick={loadData}>🔄</button>
            <button
              className="btn-icon"
              title="Open Edited Photos Folder"
              onClick={() => {
                window.api.openFolder({
                  basePath: project.folder_path,
                  customerFolder: customer.voucherCode,
                  subfolder: 'edited'
                });
              }}
            >
              📁
            </button>
          </div>
        </div>

        <div className="edited-photo-list">
          {editedPhotos.map((photo) => (
            <div
              key={photo}
              className="edited-thumbnail"
              onClick={() => handleOpenCropper(photo.originalPath)}
            >
              <img src={photo.base64Data} alt="Edited thumbnail" />
            </div>
          ))}
        </div>
        <h3>Grid Templates</h3>
        <div className="template-buttons">
          {availableTemplates.map(tpl => (
            <button
              key={tpl.id}
              className={`btn-secondary ${selectedTemplate?.id === tpl.id ? 'active' : ''}`}
              onClick={() => handleSelectTemplate(tpl)}
            >
              {tpl.name}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={handleExport}>Export Final Image</button>
      </div>

      <div className="grid-canvas">
        {selectedTemplate && layoutConfig ? (
          <div className="preview-wrapper">
            <div
              className="preview-box"
              style={previewStyle}
            >
              {gridSlots.map((slotData, index) => (
                <div
                  key={index}
                  className={`grid-cell ${firstSelectedIndex === index ? 'selected-for-swap' : ''}`}
                  onClick={() => handleGridCellClick(index)}
                  onDoubleClick={() => slotData && handleOpenCropper(slotData.originalPath, index)}
                >
                  {slotData ? <img src={slotData.base64Data} alt={`Slot ${index + 1}`} /> : <p>+</p>}
                  <button
                    className="btn-delete-slot"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevents other clicks from firing
                      handleDeleteFromSlot(index);
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
              {overlayPreviewData && (
                <img
                  src={overlayPreviewData}
                  alt="Overlay Preview"
                  className="overlay-preview-image"
                />
              )}
            </div>
            {watermarkPreviewData  && (
              <img
                src={watermarkPreviewData }
                alt="Watermark Preview"
                className="watermark-preview"
                style={watermarkPreviewStyle}
              />
            )}
          </div>
        ) : (
          <p>Select a template to begin.</p>
        )}
      </div>
    </div>

  );
}

export default GridCreator;