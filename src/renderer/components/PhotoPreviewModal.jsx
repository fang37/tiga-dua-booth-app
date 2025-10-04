import React, { useState, useEffect } from 'react';

function PhotoPreviewModal({ customer, project, onClose, onRevert, onSetActive, onGoToGridCreator, onDistribute }) {
    const [photos, setPhotos] = useState([]);

    useEffect(() => {
        const fetchPhotos = async () => {
            if (customer) {
                const photoList = await window.api.getPhotosByCustomerId(customer.id);
                const photosWithData = await Promise.all(
                    photoList.map(async (photo) => ({
                        ...photo,
                        base64Data: await window.api.getPhotoAsBase64(photo.file_path)
                    }))
                );
                setPhotos(photosWithData);
            }
        };
        fetchPhotos();
    }, [customer]);

    if (!customer) return null;

    const handleSetActiveClick = () => {
        onSetActive(customer); // Pass the current customer up
        onClose(); // Close the modal
    };

    const handleRevert = async (photoId) => {
        await onRevert([photoId]);
        // Refresh the photo list after reverting
        const updatedPhotos = await window.api.getPhotosByCustomerId(customer.id);
        const updatedPhotosWithData  = await Promise.all(
            updatedPhotos.map(async (photo) => ({
                ...photo,
                base64Data: await window.api.getPhotoAsBase64(photo.file_path)
            }))
        );
        setPhotos(updatedPhotosWithData );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
                <h2>Photos for {customer.name}</h2>
                <div className="photo-preview-grid">
                    {photos.map(photo => (
                        <div key={photo.id} className="preview-item">
                            <img src={photo.base64Data} alt="Assigned photo" />
                            <button className="btn-revert" onClick={() => handleRevert(photo.id)}>Revert</button>
                        </div>
                    ))}
                </div>
                <div className="modal-actions-left">
                    <button
                        className="btn-primary"
                        onClick={() => onDistribute(customer)}
                        disabled={customer.export_status !== 'exported'}
                        title={customer.export_status !== 'exported' ? 'You must export the grid first' : ''}
                    >
                        Distribute to Customer
                    </button>
                    <button className="btn-primary" onClick={() => onGoToGridCreator(customer)}>Create Grid</button>
                    <button className="btn-secondary" onClick={() => onSetActive(customer)}>Set as Active</button>
                    <button className="btn-secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}

export default PhotoPreviewModal;