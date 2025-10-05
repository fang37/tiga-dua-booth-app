import React, { useState, useEffect, useRef } from 'react';
import Ruler from './Ruler';

function TemplateManager({ onBack }) {
  const [templates, setTemplates] = useState([]);
  // Form State
  const [name, setName] = useState('');
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [paddingMm, setPaddingMm] = useState({ top: 5, bottom: 20, left: 5, right: 5 }); // Default in mm
  const [gapMm, setGapMm] = useState(3); // Default in mm
  const [widthMm, setWidthMm] = useState(101); // Default to 4 inches (101.6mm)
  const [heightMm, setHeightMm] = useState(152); // Default to 6 inches (152.4mm
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');

  const [watermarkPath, setWatermarkPath] = useState('');
  const [watermarkPreviewData, setWatermarkPreviewData] = useState(null);
  const [watermarkSize, setWatermarkSize] = useState(80);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.5);
  const [watermarkPosition, setWatermarkPosition] = useState({ x: 0, y: 0 });
  const watermarkRef = useRef(null);
  const [overlayPath, setOverlayPath] = useState('');
  const [overlayPreviewData, setOverlayPreviewData] = useState(null);

  const fetchTemplates = async () => {
    const tpls = await window.api.getAllTemplates();
    setTemplates(tpls);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handlePaddingChange = (e) => {
    setPaddingMm({ ...paddingMm, [e.target.name]: parseInt(e.target.value) || 0 });
  };

  const handleSelectWatermark = async () => {
    const sourcePath = await window.api.openFileDialog();
    if (sourcePath) {
      setWatermarkPath(sourcePath);
      const data = await window.api.getPhotoAsBase64(sourcePath);
      setWatermarkPreviewData(data);
    }
  };

  const handleRemoveWatermark = () => {
    setWatermarkPath('');
    setWatermarkPreviewData(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cellWidth = (widthMm - paddingMm.left - paddingMm.right - (gapMm * (cols - 1))) / cols;
    const cellHeight = (heightMm - paddingMm.top - paddingMm.bottom - (gapMm * (rows - 1))) / rows;

    const layout_config = {
      rows,
      cols,
      gap_mm: gapMm,
      padding_mm: paddingMm,
      print_width_mm: widthMm,
      print_height_mm: heightMm,
      grid_aspect_ratio: `${widthMm} / ${heightMm}`, // For the preview container
      crop_aspect_ratio: cellWidth / cellHeight,    // The crucial value for the cropper
      watermark: {
        path: watermarkPath,
        size: watermarkSize,
        opacity: watermarkOpacity,
        position: watermarkPosition,
      }
    };

    await window.api.createTemplate({
      name,
      layout_config,
      background_color: backgroundColor
    });
    // Reset form and refresh list
    setName('');
    setWatermarkPath('');
    fetchTemplates();
  };

  const handleExportBlank = async (template) => {
    const result = await window.api.exportBlankTemplate(template);
    if (result.success) {
      // Call the new, direct function with the full file path
      window.api.showItemInFolder(result.path);
    } else {
      alert(`Error exporting blank: ${result.error}`);
    }
  };

  const handleSetOverlay = async (templateId) => {
    const sourcePath = await window.api.openFileDialog();
    if (sourcePath) {
      const result = await window.api.setTemplateOverlay({ templateId, sourcePath });
      setOverlayPath(result.path);
      const data = await window.api.getPhotoAsBase64(result.path);
      setOverlayPreviewData(data);
      fetchTemplates();
    }
  };

  const handleRemoveOverlay = async (templateId) => {
    const result = await window.api.removeTemplateOverlay(templateId);
    if (result.success) {
      // Clear the preview if we're removing the overlay from the currently previewed template
      if (name === templates.find(t => t.id === templateId)?.name) {
        setOverlayPath('');
        setOverlayPreviewData(null);
      }
      fetchTemplates(); // Refresh the list
    } else {
      alert(`Error removing overlay: ${result.error}`);
    }
  };

  const handlePreviewTemplate = async (template) => {
    const config = JSON.parse(template.layout_config);

    setName(template.name);
    setRows(config.rows);
    setCols(config.cols);
    setGapMm(config.gap_mm);
    setWidthMm(config.print_width_mm);
    setHeightMm(config.print_height_mm);
    setPaddingMm(config.padding_mm);
    setBackgroundColor(template.background_color);
    if (config.watermark && config.watermark.path) {
      setWatermarkPath(config.watermark.path || '');
      setWatermarkSize(config.watermark.size || 80);
      setWatermarkOpacity(config.watermark.opacity || 0.5);
      setWatermarkPosition(config.watermark.position || { x: 50, y: 50 });
      const data = await window.api.getPhotoAsBase64(config.watermark.path);
      setWatermarkPreviewData(data);
    } else {
      setWatermarkPath('');
      setWatermarkPreviewData(null);
    }

    setOverlayPath(template.overlay_image_path || '');
    if (template.overlay_image_path) {
      // Fetch the Base64 data for the preview
      const data = await window.api.getPhotoAsBase64(template.overlay_image_path);
      setOverlayPreviewData(data);
    } else {
      setOverlayPreviewData(null);
    }
  };

  const handlePositionChange = (e) => {
    setWatermarkPosition({ ...watermarkPosition, [e.target.name]: e.target.value });
  };

  const watermarkPreviewStyle = {
    position: 'absolute',
    opacity: watermarkOpacity,
    width: `${watermarkSize}%`,
    // Use the x and y percentages to position the watermark
    left: `${watermarkPosition.x}%`,
    top: `${watermarkPosition.y}%`,
    transform: 'translate(-50%, -50%)', // This centers the image on the x,y coordinates
  };

  const PREVIEW_MAX_SIZE = 300; // Max width/height in pixels
  const scale = Math.min(PREVIEW_MAX_SIZE / widthMm, PREVIEW_MAX_SIZE / heightMm);

  const previewStyle = {
    width: `${widthMm * scale}px`,
    height: `${heightMm * scale}px`,
    backgroundColor: backgroundColor,
    padding: `${paddingMm.top * scale}px ${paddingMm.right * scale}px ${paddingMm.bottom * scale}px ${paddingMm.left * scale}px`,
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
    gap: `${gapMm * scale}px`,
  };

  return (
    <div className="template-manager">
      <div className="manager-header">
        <h1>Template Manager</h1>
        <button className="btn-secondary" onClick={onBack}>&larr; Back to Dashboard</button>
      </div>

      <div className="manager-grid-layout">
        {/* Column 1: Basic Settings */}
        <div className="template-form-col">
          <h3>Create New Template</h3>
          <form id="template-form" onSubmit={handleSubmit}>
            <label>Template Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required />

            <fieldset>
              <legend>Grid</legend>
              <div className="form-grid">
                <div>
                  <label className="sub-label">Rows</label>
                  <input type="number" value={rows} onChange={e => setRows(parseInt(e.target.value) || 1)} />
                </div>
                <div>
                  <label className="sub-label">Columns</label>
                  <input type="number" value={cols} onChange={e => setCols(parseInt(e.target.value) || 1)} />
                </div>
                <div>
                  <label className="sub-label">Gap (mm)</label>
                  <input type="number" value={gapMm} onChange={e => setGapMm(parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </fieldset>

            <fieldset>
              <legend>Print Size (mm)</legend>
              <div className="form-grid">
                <div>
                  <label className="sub-label">Width</label>
                  <input type="number" value={widthMm} onChange={e => setWidthMm(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="sub-label">Height</label>
                  <input type="number" value={heightMm} onChange={e => setHeightMm(parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </fieldset>

            <fieldset>
              <legend>Padding (mm)</legend>
              <div className="form-grid">
                <div>
                  <label className="sub-label">Top</label>
                  <input name="top" type="number" value={paddingMm.top} onChange={handlePaddingChange} />
                </div>
                <div>
                  <label className="sub-label">Bottom ("Chin")</label>
                  <input name="bottom" type="number" value={paddingMm.bottom} onChange={handlePaddingChange} />
                </div>
                <div>
                  <label className="sub-label">Left</label>
                  <input name="left" type="number" value={paddingMm.left} onChange={handlePaddingChange} />
                </div>
                <div>
                  <label className="sub-label">Right</label>
                  <input name="right" type="number" value={paddingMm.right} onChange={handlePaddingChange} />
                </div>
              </div>
            </fieldset>
          </form>
        </div>

        {/* Column 2: Visual Settings & Actions */}
        <div className="template-form-col">
          <h3>Visuals & Actions</h3>
          <form id="template-form">
            <div className="form-row">
              <label>Background Color</label>
              <input type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} />
            </div>

            <fieldset>
              <legend>Watermark</legend>
              <div className="file-input-wrapper">
                <button type="button" onClick={handleSelectWatermark}>Choose File</button>
                {watermarkPath && (
                  <>
                    <span>{watermarkPath.split(/[\\/]/).pop()}</span>
                    <button
                      type="button"
                      className="btn-remove-file"
                      onClick={handleRemoveWatermark}
                    >
                      &times;
                    </button>
                  </>
                )}
              </div>
              {watermarkPath && (
                <>
                  <label className="sub-label">Size (%)</label>
                  <input type="range" min="10" max="100" value={watermarkSize} onChange={e => setWatermarkSize(e.target.value)} />
                  <label className="sub-label">Opacity</label>
                  <input type="range" min="0.1" max="1" step="0.1" value={watermarkOpacity} onChange={e => setWatermarkOpacity(e.target.value)} />

                  <label className="sub-label">Position X: {watermarkPosition.x}%</label>
                  <input type="range" min="0" max="100" name="x" value={watermarkPosition.x} onChange={handlePositionChange} />
                  <label className="sub-label">Position Y: {watermarkPosition.y}%</label>
                  <input type="range" min="0" max="100" name="y" value={watermarkPosition.y} onChange={handlePositionChange} />
                </>
              )}
            </fieldset>

            <button type="submit" form="template-form" className="btn-primary">Save Template</button>
          </form>
        </div>

        {/* Column 3: Preview & List */}
        <div className="template-preview-col">
          <div className="template-preview-container">
            <h3>Live Preview</h3>
            <div className="preview-wrapper">
              <Ruler lengthMm={widthMm} scale={scale} orientation="horizontal" />
              <Ruler lengthMm={heightMm} scale={scale} orientation="vertical" />
              <div className="preview-box" style={previewStyle}>
                {Array.from({ length: rows * cols }).map((_, i) => (
                  <div key={i} className="preview-cell"></div>
                ))}
                {overlayPreviewData && (
                  <img
                    src={overlayPreviewData} // Use the Base64 data directly
                    alt="Overlay Preview"
                    className="overlay-preview-image"
                  />
                )}
                {watermarkPreviewData && (
                  <img
                    ref={watermarkRef}
                    src={watermarkPreviewData}
                    alt="Watermark Preview"
                    className="watermark-preview"
                    style={watermarkPreviewStyle}
                  />
                )}
              </div>
            </div>
          </div>
          <div className="template-list-container">
            <h3>Existing Templates</h3>
            <div className="template-list">
              {templates.map(tpl => (
                <div className="template-item">
                  <span>{tpl.name}</span>
                  {/* {tpl.overlay_image_path && (
                    <img src={tpl.overlay_image_path} className="overlay-thumbnail-preview" alt="Overlay" />
                  )} */}
                  <div className="template-item-actions">
                    <button className="btn-secondary btn-small" onClick={() => handlePreviewTemplate(tpl)}>Preview</button>
                    <button className="btn-secondary btn-small" onClick={() => handleSetOverlay(tpl.id)}>Set Overlay</button>
                    {tpl.overlay_image_path && (
                      <button className="btn-secondary btn-small btn-danger" onClick={() => handleRemoveOverlay(tpl.id)}>Remove Overlay</button>
                    )}
                    <button className="btn-secondary btn-small" onClick={() => handleExportBlank(tpl)}>Export Blank</button>
                  </div>
                </div>

              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default TemplateManager;