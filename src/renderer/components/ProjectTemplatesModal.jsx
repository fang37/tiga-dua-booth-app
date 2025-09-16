import React, { useState, useEffect } from 'react';

function ProjectTemplatesModal({ project, onClose, onSave }) {
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    const fetchTemplates = async () => {
      if (project) {
        const tpls = await window.api.getTemplatesForProject(project.id);
        setTemplates(tpls);
      }
    };
    fetchTemplates();
  }, [project]);

  if (!project) return null;

  const handleToggle = (templateId) => {
    setTemplates(prevTemplates =>
      prevTemplates.map(tpl =>
        tpl.id === templateId
          ? { ...tpl, checked: tpl.checked ? 0 : 1 }
          : tpl
      )
    );
  };
  
  const handleSave = () => {
    const selectedIds = templates.filter(t => t.checked).map(t => t.id);
    onSave(project.id, selectedIds);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Manage Templates for "{project.name}"</h2>
        <div className="template-checklist">
          {templates.map(tpl => (
            <div key={tpl.id} className="checklist-item">
              <input
                type="checkbox"
                id={`tpl-${tpl.id}`}
                checked={!!tpl.checked}
                onChange={() => handleToggle(tpl.id)}
              />
              <label htmlFor={`tpl-${tpl.id}`}>{tpl.name}</label>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

export default ProjectTemplatesModal;