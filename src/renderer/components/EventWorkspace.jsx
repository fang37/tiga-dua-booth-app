import React, { useState, useEffect } from 'react';
import PhotoPreviewModal from './PhotoPreviewModal';
import path from 'path';
import BatchDistributeModal from './BatchDistributeModal';

function EventWorkspace({ projectId, onBack, onGoToGridCreator }) {
  const [project, setProject] = useState(null);
  const [customerList, setCustomerList] = useState([]);
  const [activeCustomer, setActiveCustomer] = useState(null);
  const [previewCustomer, setPreviewCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  // State for the check-in form
  const [voucherCode, setVoucherCode] = useState('');
  const [foundVoucher, setFoundVoucher] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  // State for photo management
  const [unassignedPhotos, setUnassignedPhotos] = useState([]);
  const [selectedPhotos, setSelectedPhotos] = useState(new Set());
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [pinnedPhoto, setPinnedPhoto] = useState(null);

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  const fetchCustomers = async () => {
    const customers = await window.api.getCustomersByProjectId(projectId);
    setCustomerList(customers);
  };

  const loadData = async () => {
    // Run the health check first to clean up any bad data
    await window.api.runHealthCheckForProject(projectId);

    // Now fetch the clean data
    const projectDetails = await window.api.getProjectById(projectId);
    setProject(projectDetails);
    const customers = await window.api.getCustomersByProjectId(projectId);
    setCustomerList(customers);
  };

  useEffect(() => {
    // Fetch project details when the component loads
    const loadProjectAndStartWatcher = async () => {
      const projectDetails = await window.api.getProjectById(projectId);
      setProject(projectDetails);

      const customers = await window.api.getCustomersByProjectId(projectId);
      setCustomerList(customers);

      window.api.startWatching(projectDetails.folder_path);
    };

    loadProjectAndStartWatcher();

    const handleDataChanged = () => {
      console.log('Data changed event received, refreshing customer list...');
      fetchCustomers();
    };

    document.addEventListener('data-changed', handleDataChanged);

    loadData()

    // Listen for new photos from the main process
    window.api.onNewPhoto((photo) => {
      setUnassignedPhotos(prevPhotos => {
        // Avoid duplicates based on the original raw path
        const isAlreadyListed = prevPhotos.some(p => p.rawPath === photo.rawPath);
        return isAlreadyListed ? prevPhotos : [...prevPhotos, photo];
      });
    });

    // Cleanup function: stop watching when the component is unmounted
    return () => {
      window.api.stopWatching();
      document.removeEventListener('data-changed', handleDataChanged);
    };
  }, [projectId]);

  const handleTogglePhotoSelection = (photo) => {
    setPinnedPhoto(photo.rawPath);

    const newSelection = new Set(selectedPhotos);
    if (newSelection.has(photo)) {
      newSelection.delete(photo);
    } else {
      newSelection.add(photo);
    }
    setSelectedPhotos(newSelection);
  };

  const handleAssignPhotos = async () => {
    if (selectedPhotos.size === 0 || !activeCustomer) return;

    // Extract just the rawPaths to send to the backend
    const rawPaths = Array.from(selectedPhotos).map(p => p.rawPath);

    const result = await window.api.assignPhotos({
      customerId: activeCustomer.id,
      photoPaths: rawPaths // Send only the original paths
    });

    if (result.success) {
      // Filter out the assigned photos
      setUnassignedPhotos(prev => prev.filter(p => !selectedPhotos.has(p)));
      setSelectedPhotos(new Set());
      loadData();
    } else {
      alert(`Error assigning photos: ${result.error}`);
    }
  };

  const handleRevertPhotos = async (photoIds) => {
    await window.api.revertPhotosToRaw({ photoIds, projectId });
    // After reverting, refresh the customer list to show the new photo counts
    loadData();
  };

  const handleFindVoucher = async () => {
    if (!voucherCode) return;
    const result = await window.api.findVoucherByCode({ projectId, voucherCode });
    if (result) {
      setFoundVoucher(result);
    } else {
      alert('Voucher not found or has already been redeemed.');
    }
  };

  const handleRedeemVoucher = async () => {
    if (!customerName) {
      alert('Please enter a customer name.');
      return;
    }

    const result = await window.api.redeemVoucher({
      voucherCode: foundVoucher.code,
      name: customerName,
      email: customerEmail,
      phoneNumber: customerPhone,
    });

    if (result.success) {
      setActiveCustomer({
        id: result.customerId,
        name: customerName,
        voucherCode: foundVoucher.code
      });

      loadData();

      setFoundVoucher(null);
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setVoucherCode('');
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  const handleDistribute = async (customer) => {
    alert('Starting distribution process...');
    const result = await window.api.distributeSingleCustomer(customer.id);

    if (result.success) {
      fetchCustomers();
      alert(`Distribution complete for ${customer.name}!`);
    } else {
      fetchCustomers();
      alert(`Distribution failed: ${result.error}`);
    }
  };

  const filteredCustomers = customerList.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.voucherCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!project) {
    return <div>Loading project...</div>;
  }

  const photoToShow = previewPhoto ? previewPhoto : pinnedPhoto;

  return (
    <div className="workspace-container">
      <BatchDistributeModal isOpen={isBatchModalOpen} onClose={() => setIsBatchModalOpen(false)} projectId={projectId} />
      <PhotoPreviewModal
        customer={previewCustomer}
        project={project}
        onClose={() => setPreviewCustomer(null)}
        onRevert={handleRevertPhotos}
        onSetActive={setActiveCustomer}
        onGoToGridCreator={onGoToGridCreator}
        onDistribute={handleDistribute}
      />

      <div className="workspace-header">
        <button className="btn-secondary" onClick={onBack}>
          &larr; Back to Projects
        </button>
        <h1>{project.name}</h1>
        <button className="btn-primary" onClick={() => setIsBatchModalOpen(true)}>
          Batch Distribute
        </button>
      </div>

      <div className="workspace-main-content">
        <div className="workspace-left-col">
          <div className="check-in-panel">
            <div className="panel-header">
              <h3>Customer Check-in</h3>
            </div>
            {foundVoucher && (
              <button className="btn-secondary btn-small" onClick={() => setFoundVoucher(null)}>
                Cancel
              </button>
            )}
            {/* This part shows before a voucher is found */}
            {!foundVoucher && (
              <div className="find-voucher-form">
                <input
                  type="text"
                  placeholder="Enter Voucher Code..."
                  className="voucher-input"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  autoFocus
                />
                <button className="btn-primary" onClick={handleFindVoucher}>Find Voucher</button>
              </div>
            )}

            {/* This part appears only AFTER a valid voucher is found */}
            {foundVoucher && (
              <div className="registration-form">
                <p>Voucher Found: <strong>{foundVoucher.code}</strong></p>
                <label htmlFor="customerName">Customer Name</label>
                <input
                  id="customerName"
                  type="text"
                  className="modal-input"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Full Name"
                  autoFocus
                />
                <label htmlFor="customerEmail">Email (Optional)</label>
                <input
                  id="customerEmail"
                  type="email"
                  className="modal-input"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="example@email.com"
                />
                <label htmlFor="customerPhone">Phone Number (Optional)</label>
                <input
                  id="customerPhone"
                  type="tel"
                  className="modal-input"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="08123456789"
                />
                <button className="btn-primary" onClick={handleRedeemVoucher}>Complete Registration</button>
              </div>
            )}
          </div>

          <div className="unassigned-photos-panel">
            <div className="panel-header">
              <h3>Unassigned Photos ({unassignedPhotos.length})</h3>
              <button
                className="btn-icon"
                title="Open Raw Photos Folder"
                onClick={() => window.api.openFolder({
                  basePath: project.folder_path,
                  subfolder: 'raw'
                })}
              >
                📁
              </button>
            </div>
            <div className="unassigned-content">
              <div className="photo-queue">
                {unassignedPhotos.map(photo => (
                  <div
                    key={photo.rawPath}
                    className={`photo-thumbnail ${selectedPhotos.has(photo) ? 'selected' : ''}`}
                    onClick={() => handleTogglePhotoSelection(photo)}
                    onMouseEnter={() => setPreviewPhoto(photo.rawPath)}
                    onMouseLeave={() => setPreviewPhoto(null)}
                  >
                    <img src={`file://${photo.thumbPath}`} alt="thumbnail" />
                  </div>
                ))}
              </div>
              <div className="photo-preview-area">
                {photoToShow ? (
                  <img src={`file://${photoToShow}`} alt="Preview" />
                ) : (
                  <div className="preview-placeholder">
                    <p>Hover or click a thumbnail to preview</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>


        <div className="workspace-sidebar">
          <div className="active-customer-panel">
            <h3>Active Customer</h3>
            <h3>x</h3>
            {activeCustomer ? (
              <>
                <p><strong>Name:</strong> {activeCustomer.name}</p>
                <p><strong>Voucher:</strong> {activeCustomer.voucherCode}</p>
                <button
                  className="btn-primary assign-btn"
                  onClick={handleAssignPhotos}
                  disabled={selectedPhotos.size === 0}
                >
                  Assign {selectedPhotos.size} Photos to {activeCustomer.name.split(' ')[0]}
                </button>
              </>
            ) : (
              <p>No customer active. Check in a customer to begin.</p>
            )}
          </div>

          <div className="customer-list-panel">
            <div className="panel-header">
              <h3>Project Customers</h3>
              <button className="btn-secondary btn-small" onClick={fetchCustomers}>Refresh</button>
            </div>

            <input
              type="text"
              placeholder="Search by name or code..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div className="customer-list-scroll">
              {filteredCustomers.length > 0 ? (
                // 4. Map over the NEW filteredCustomers array
                filteredCustomers.map(cust => (
                  <div
                    key={cust.id}
                    className="customer-list-item"
                    onClick={() => setPreviewCustomer(cust)}
                  >
                    <div className="customer-info">
                      <p><strong>{cust.name}</strong></p>
                      <span>{cust.voucherCode}</span>
                    </div>
                    <div className="customer-badges">
                      {cust.distribution_status === 'distributed' && <span className="badge distributed">✔ Distributed</span>}
                      {cust.distribution_status === 'uploaded' && <span className="badge uploaded">✔ Uploaded</span>}
                      {cust.distribution_status === 'failed' && <span className="badge failed">✖ Failed</span>}
                      {cust.export_status === 'exported' && (cust.distribution_status === 'pending' || cust.distribution_status === 'exported') && <span className="badge exported">✔ Exported</span>}
                      <div className="photo-count">{cust.photoCount}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted-text">No customers found.</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default EventWorkspace;