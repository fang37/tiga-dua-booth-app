import React, { useState, useEffect } from 'react';
import { useNotification } from './NotificationContext';
import PrintCopiesModal from './PrintCopiesModal';

function PhotoPreviewModal({ customer, project, onClose, onRevert, onSetActive, onGoToGridCreator, onDistribute, onUpdate }) {
    const [photos, setPhotos] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const { showNotification } = useNotification();

    useEffect(() => {
        const fetchPhotos = async () => {
            if (customer) {
                const photoList = await window.api.getPhotosByCustomerId(customer.id);
                const photosWithData = await Promise.all(
                    photoList.map(async (photo) => ({
                        ...photo,
                        base64Data: await window.api.getProjectFileAsBase64(photo.file_path)
                    }))
                );
                setPhotos(photosWithData);
            }
        };
        fetchPhotos();
    }, [customer]);

    const handleAction = async (action) => {
        setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:4000/api/customer/${customer.id}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: action }),
            });

            if (!response.ok) {
                // Try to parse the error as JSON, but have a fallback.
                let errorMsg = 'Failed to send action';
                try {
                    const err = await response.json();
                    errorMsg = err.error || 'Unknown server error';
                } catch (e) {
                    // If the error wasn't JSON, just use the status text.
                    errorMsg = response.statusText;
                }
                throw new Error(errorMsg);
            }

            // Only call response.json() if we know the request was successful
            const result = await response.json();

            console.log(`Status updated to '${result.newStatus}'!`);
            // showNotification(`Status updated to '${result.newStatus}'!`, 'success');
            onUpdate();
            onClose();

        } catch (err) {
            showNotification(err.message, 'error');
        }
        setIsLoading(false);
    };

    const handleQueuePrint = async (copies) => {
        setIsLoading(true);
        setIsPrintModalOpen(false); // Close the copies modal
        try {
            const response = await fetch(`http://localhost:4000/api/customer/${customer.id}/queue-print`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ copies: copies }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            showNotification(`${copies} copies added to print queue!`, 'success');
            onUpdate(); // Refresh the main customer list
            onClose();  // Close the main preview modal

        } catch (err) {
            showNotification(err.message, 'error');
        }
        setIsLoading(false);
    };

    if (!customer) return null;

    const status = customer.workflow_status;
    const canStartEditing = (status === 'assigned');
    const canFinishEditing = (status === 'editing' || status === 'assigned' || status === 'exported');
    const canDistribute = (status === 'exported' || status === 'uploaded' || status === 'distributed' || status === 'failed');
    const canGrid = (status === 'edited' || status === 'exported' || status === 'uploaded' || status === 'distributed');
    const canPrint = (status === 'exported' || status === 'uploaded' || status === 'distributed' || status === 'printed' || status === 'failed');

    const handleSetActiveClick = () => {
        onSetActive(customer); // Pass the current customer up
        onClose(); // Close the modal
    };

    const handleRevert = async (photoId) => {
        await onRevert([photoId]);
        // Refresh the photo list after reverting
        const updatedPhotos = await window.api.getPhotosByCustomerId(customer.id);
        const updatedPhotosWithData = await Promise.all(
            updatedPhotos.map(async (photo) => ({
                ...photo,
                base64Data: await window.api.getPhotoAsBase64(photo.file_path)
            }))
        );
        setPhotos(updatedPhotosWithData);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <PrintCopiesModal
                isOpen={isPrintModalOpen}
                onClose={() => setIsPrintModalOpen(false)}
                onSubmit={handleQueuePrint}
            />

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
                    {canPrint && (
                        <button className="btn-primary" onClick={() => setIsPrintModalOpen(true)} disabled={isLoading}>
                            Add to Print Queue
                        </button>
                    )}
                    {canStartEditing && (
                        <button className="btn-secondary" onClick={() => handleAction('START_EDITING')} disabled={isLoading}>Start Editing</button>
                    )}
                    {canFinishEditing && (
                        <button className="btn-primary" onClick={() => handleAction('FINISH_EDITING')} disabled={isLoading}>Finish Editing</button>
                    )}
                    <button
                        className="btn-primary"
                        onClick={() => onDistribute(customer)}
                        disabled={customer.workflow_status !== 'exported'}
                        title={customer.workflow_status !== 'exported' ? 'You must export the grid first' : ''}
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