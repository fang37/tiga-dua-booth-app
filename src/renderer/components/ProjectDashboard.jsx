import React, { useState, useEffect } from 'react';
import NewProjectModal from './NewProjectModal';

function ProjectDashboard({ onProjectSelect }) {
  const [projects, setProjects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Function to fetch projects and update state
  const fetchProjects = async () => {
    const projectList = await window.api.getProjects();
    setProjects(projectList);
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

  return (
    <div className="dashboard-container">
      <NewProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateProject}
      />

      <div className="dashboard-header">
        <h1>Projects</h1>
        {/* 5. The button now just opens the modal */}
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          New Project
        </button>
      </div>
      <div className="project-list">
        {projects.length > 0 ? (
          projects.map((project) => (
            <div key={project.id} className="project-item" onClick={() => onProjectSelect(project.id)}>
              <h3>{project.name}</h3>
              <p>{project.event_date}</p>
            </div>
          ))
        ) : (
          <p>No projects found. Click "New Project" to get started!</p>
        )}
      </div>
    </div>
  );
}

export default ProjectDashboard;