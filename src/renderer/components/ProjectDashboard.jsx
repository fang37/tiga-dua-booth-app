import React, { useState, useEffect } from 'react';
import NewProjectModal from './NewProjectModal';
import ProjectTemplatesModal from './ProjectTemplatesModal';
import GenerateVouchersModal from './GenerateVouchersModal';

function ProjectDashboard({ onProjectSelect }) {
  const [projects, setProjects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedProjectForVouchers, setSelectedProjectForVouchers] = useState(null);

  // Function to fetch projects and update state
  const fetchProjects = async () => {
    const projectList = await window.api.getProjects();
    setProjects(projectList);
  };

  const handleSaveTemplates = async (projectId, templateIds) => {
    await window.api.setTemplatesForProject({ projectId, templateIds });
    setSelectedProject(null);
  };

  // useEffect runs once when the component mounts
  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async ({ name, date }) => {
    const result = await window.api.createProject({ name, event_date: date });

    setIsModalOpen(false);

    if (result.success) {
      fetchProjects();
    } else {
      alert(`Error creating project: ${result.error}`);
    }
  };

  const handleGenerateVouchers = async (projectId, quantity) => {
    const result = await window.api.generateVouchersAndQRCodes({ projectId, quantity });
    if (result.success) {
      alert(`${result.count} vouchers and QR codes generated successfully!`);
    } else {
      alert(`Error: ${result.error}`);
    }
    setSelectedProjectForVouchers(null);
  };

  return (
    <div className="dashboard-container">
      <NewProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateProject}
      />

      <ProjectTemplatesModal
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
        onSave={handleSaveTemplates}
      />

      <GenerateVouchersModal
        project={selectedProjectForVouchers}
        onClose={() => setSelectedProjectForVouchers(null)}
        onGenerate={handleGenerateVouchers}
      />

      <div className="dashboard-header">
        <h1>Projects</h1>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          New Project
        </button>
      </div>
      <div className="project-list">
        {projects.map((project) => (
          <div key={project.id} className="project-item">
            <div className="project-item-main" onClick={() => onProjectSelect(project.id)}>
              <h3>{project.name}</h3>
              <p>{project.event_date}</p>
            </div>
            <button
              className="btn-secondary btn-small"
              onClick={() => setSelectedProject(project)}
            >
              Manage Templates
            </button>
            <button
              className="btn-secondary btn-small"
              onClick={() => setSelectedProjectForVouchers(project)}
            >
              Generate Vouchers
            </button>
            <button
              className="btn-secondary btn-small"
              onClick={() => window.api.openFolder({
                relativeProjectPath: project.folder_path,
                subfolder: 'qrcodes'
              })}
            >
              View QR Codes
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProjectDashboard;