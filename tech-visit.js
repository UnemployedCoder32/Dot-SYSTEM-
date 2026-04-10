document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const activeJobsSelect = document.getElementById('activeJobsSelect');
    const jobSelectorPanel = document.getElementById('jobSelectorPanel');
    const servicePanel = document.getElementById('servicePanel');
    const dispCustomer = document.getElementById('dispCustomer');
    const dispAddress = document.getElementById('dispAddress');
    const dispType = document.getElementById('dispType');
    const dispIssue = document.getElementById('dispIssue');
    const notesInput = document.getElementById('techNotes');
    const photoInput = document.getElementById('photoInput');
    const photoDropzone = document.getElementById('photoDropzone');
    const sigCanvas = document.getElementById('sigCanvas');
    const toast = document.getElementById('toast');

    // State
    let availableJobs = [];
    let selectedJob = null;
    let signatureContext = null;
    let isDrawing = false;
    let capturedPhotoBase64 = null;

    // --- Data Loading ---
    const loadState = () => {
        const repairs = (DataController.getRepairs() || []).filter(j => j.status !== 'Completed' && j.status !== 'Delivered');
        const serviceCalls = (DataController.getNonAmcCalls() || []).filter(c => c.status !== 'Completed');
        
        availableJobs = [
            ...repairs.map(r => ({ ...r, originType: 'Repair', display: `[Repair] ${r.customerName} - ${r.deviceModel}` })),
            ...serviceCalls.map(s => ({ ...s, originType: 'Service', display: `[Call] ${s.customerName} - ${s.issue}` }))
        ];

        renderJobOptions();
    };

    window.addEventListener('dataUpdate', (e) => {
        if(!selectedJob) loadState();
    });

    const renderJobOptions = () => {
        activeJobsSelect.innerHTML = '<option value="">-- Select A Pending Job --</option>';
        availableJobs.forEach(job => {
            const opt = document.createElement('option');
            opt.value = job.id;
            opt.textContent = job.display;
            activeJobsSelect.appendChild(opt);
        });
    };

    // --- Job Selection ---
    window.loadSelectedJob = () => {
        const jid = activeJobsSelect.value;
        if (!jid) {
            alert('Please select a job first.');
            return;
        }

        selectedJob = availableJobs.find(j => j.id === jid);
        
        dispCustomer.textContent = selectedJob.customerName || 'Unknown Customer';
        dispAddress.textContent = selectedJob.customerPhone || 'Phone Not Provided';
        dispType.textContent = selectedJob.originType;
        dispType.className = `badge ${selectedJob.originType === 'Repair' ? 'bg-primary' : 'bg-success'}`;
        dispIssue.textContent = selectedJob.issue || selectedJob.deviceModel || 'No details.';

        // Show Service Panel
        jobSelectorPanel.style.display = 'none';
        servicePanel.style.display = 'block';

        initSignaturePad();
    };

    // --- Photo Handling (Base64) ---
    photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // Resize for highly-compressed base64
                const max_size = 800;
                let w = img.width;
                let h = img.height;
                if (w > h) { if (w > max_size) { h *= max_size / w; w = max_size; } } 
                else { if (h > max_size) { w *= max_size / h; h = max_size; } }

                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                
                capturedPhotoBase64 = canvas.toDataURL('image/jpeg', 0.6); // 60% quality jpeg
                
                photoDropzone.innerHTML = `<img src="${capturedPhotoBase64}">`;
                photoDropzone.classList.add('has-image');
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // --- Signature Pad Logic ---
    const initSignaturePad = () => {
        signatureContext = sigCanvas.getContext('2d');
        
        // Match CSS element size to internal drawing size
        const resizeCanvas = () => {
            const rect = sigCanvas.parentElement.getBoundingClientRect();
            sigCanvas.width = rect.width;
            sigCanvas.height = rect.height;
            signatureContext.strokeStyle = '#0f172a';
            signatureContext.lineWidth = 3;
            signatureContext.lineCap = 'round';
            signatureContext.lineJoin = 'round';
        };
        resizeCanvas();
        // window.addEventListener('resize', resizeCanvas); // Usually static on mobile but good practice

        const getPos = (e) => {
            const rect = sigCanvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return { x: clientX - rect.left, y: clientY - rect.top };
        };

        const startDraw = (e) => {
            e.preventDefault();
            isDrawing = true;
            const pos = getPos(e);
            signatureContext.beginPath();
            signatureContext.moveTo(pos.x, pos.y);
        };

        const draw = (e) => {
            e.preventDefault();
            if (!isDrawing) return;
            const pos = getPos(e);
            signatureContext.lineTo(pos.x, pos.y);
            signatureContext.stroke();
        };

        const endDraw = () => {
            isDrawing = false;
            signatureContext.closePath();
        };

        sigCanvas.addEventListener('mousedown', startDraw);
        sigCanvas.addEventListener('mousemove', draw);
        sigCanvas.addEventListener('mouseup', endDraw);
        sigCanvas.addEventListener('mouseout', endDraw);

        sigCanvas.addEventListener('touchstart', startDraw, {passive: false});
        sigCanvas.addEventListener('touchmove', draw, {passive: false});
        sigCanvas.addEventListener('touchend', endDraw);
    };

    window.clearSignature = () => {
        if (!signatureContext) return;
        signatureContext.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    };

    const isSignatureEmpty = () => {
        const blank = document.createElement('canvas');
        blank.width = sigCanvas.width;
        blank.height = sigCanvas.height;
        return sigCanvas.toDataURL() === blank.toDataURL();
    };

    // --- Job Completion ---
    window.completeJob = async () => {
        if (!selectedJob) return;

        let signatureBase64 = null;
        if (!isSignatureEmpty()) {
            signatureBase64 = sigCanvas.toDataURL('image/png'); // Can compress further or leave as transparent PNG
        }

        const updates = {
            status: 'Completed',
            completionNotes: notesInput.value.trim(),
            fieldSignature: signatureBase64,
            fieldPhoto: capturedPhotoBase64,
            completedAt: new Date().toISOString()
        };

        // Apply back to DataController
        if (selectedJob.originType === 'Repair') {
            const repairs = DataController.getRepairs();
            const idx = repairs.findIndex(r => r.id === selectedJob.id);
            if (idx > -1) {
                repairs[idx] = { ...repairs[idx], ...updates };
                DataController.saveRepairs(repairs);
                DataController.logActivity(`Repair ${selectedJob.id} completed via Field PWA.`);
            }
        } else {
            const calls = DataController.getNonAmcCalls();
            const idx = calls.findIndex(c => c.id === selectedJob.id);
            if (idx > -1) {
                calls[idx] = { ...calls[idx], ...updates };
                DataController.saveNonAmcCalls(calls);
                DataController.logActivity(`Service Call ${selectedJob.id} completed via Field PWA.`);
            }
        }

        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            window.location.reload();
        }, 2000);
    };

    loadState();
});
