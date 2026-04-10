document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('mainContent');
    const custName = document.getElementById('custName');
    const custContact = document.getElementById('custContact');
    const custAddress = document.getElementById('custAddress');
    const amcStatus = document.getElementById('amcStatus');
    const amcValidUntil = document.getElementById('amcValidUntil');
    const historyTimeline = document.getElementById('historyTimeline');
    const diamondBadge = document.getElementById('diamondBadge');

    // Parse URL Parameter
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('cid') || urlParams.get('phone') || urlParams.get('id');

    if (!searchParam) {
        showError("Invalid or Missing Tracking ID. Please scan your Machine QR Code again.");
        return;
    }

    const loadPortalData = () => {
        // Wait briefly for firebase sync via DataController
        setTimeout(() => {
            const repairs = DataController.getRepairs() || [];
            const amcs = DataController.getAmcContracts() || [];
            const calls = DataController.getNonAmcCalls() || [];
            const clvStats = DataController.getCustomerCLV() || [];

            // Find matching data across systems (Search by AMC ID, Repair ID, Phone, or OrgName)
            const query = searchParam.toLowerCase();
            
            // Build Unified Profile
            let profileName = "Unknown Customer";
            let profilePhone = "N/A";
            let activeAmc = null;
            let history = [];

            // 1. Check AMCs
            const matchedAmc = amcs.find(a => a.id.toLowerCase() === query || (a.contact && a.contact.toLowerCase() === query));
            if (matchedAmc) {
                profileName = matchedAmc.orgName;
                profilePhone = matchedAmc.contact;
                activeAmc = matchedAmc;
                history.push({
                    date: new Date(matchedAmc.startDate || matchedAmc.createdAt),
                    title: 'AMC Contract Initiated',
                    desc: `Covered Items: ${typeof matchedAmc.assets === 'string' ? matchedAmc.assets : 'System Network'}`,
                    type: 'amc'
                });
            }

            // 2. Scan Service Calls related to this customer
            calls.forEach(c => {
                if (c.orgId === matchedAmc?.id || (c.customerPhone && c.customerPhone.toLowerCase() === query)) {
                    if (profileName === 'Unknown Customer') profileName = c.customerName;
                    history.push({
                        date: new Date(c.createdAt),
                        title: `Service Visit: ${c.status}`,
                        desc: c.issue || 'Routine Checkup / Repair',
                        type: 'visit'
                    });
                }
            });

            // 3. Scan Repairs
            repairs.forEach(r => {
                if (r.id.toLowerCase() === query || (r.phone && r.phone.toLowerCase() === query)) {
                    if (profileName === 'Unknown Customer') profileName = r.customerName;
                    if (profilePhone === 'N/A') profilePhone = r.phone;
                    history.push({
                        date: new Date(r.createdAt.split(',')[0]),
                        title: `Workshop Repair: ${r.status}`,
                        desc: `Device: ${r.deviceType} ${r.model}. Issue: ${r.deviceIssue}`,
                        type: 'repair'
                    });
                }
            });

            if (profileName === 'Unknown Customer' && history.length === 0) {
                showError("No service records found for the given ID.");
                return;
            }

            // Render Profile
            custName.innerHTML = `${escapeXml(profileName)} <span id="diamondBadge" style="display:none;" class="diamond-badge"><i class="fa-solid fa-gem"></i> VIP</span>`;
            custContact.innerHTML = `<i class="fa-solid fa-phone"></i> ${escapeXml(profilePhone)}`;

            // Diamond Check
            const top5Diamond = clvStats.slice(0, 5).filter(c => c.totalValue > 5000).map(c => c.name.toLowerCase());
            if (top5Diamond.includes(profileName.toLowerCase())) {
                document.getElementById('diamondBadge').style.display = 'inline-block';
            }

            // Render AMC Status
            if (activeAmc) {
                const eDate = new Date(activeAmc.endDate);
                const isExpired = eDate < new Date();
                amcValidUntil.textContent = `Expires: ${eDate.toLocaleDateString()}`;
                if (isExpired) {
                    amcStatus.textContent = 'Expired';
                    amcStatus.className = 'status-pill status-expired';
                } else {
                    amcStatus.textContent = 'Active & Covered';
                    amcStatus.className = 'status-pill status-active';
                }
            } else {
                amcStatus.textContent = 'No Active AMC';
                amcStatus.className = 'status-pill';
                amcStatus.style.background = '#f1f5f9';
                amcStatus.style.color = '#475569';
                amcValidUntil.textContent = '--';
            }

            // Render Timeline
            history.sort((a, b) => b.date - a.date); // Newest first

            if (history.length === 0) {
                historyTimeline.innerHTML = '<div class="empty-state"><i class="fa-solid fa-file-circle-xmark"></i><p>No service history recorded yet.</p></div>';
            } else {
                historyTimeline.innerHTML = history.map(item => `
                    <div class="timeline-item">
                        <div class="timeline-date">${item.date.toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})}</div>
                        <div class="timeline-title">${escapeXml(item.title)}</div>
                        <div class="timeline-desc">${escapeXml(item.desc)}</div>
                    </div>
                `).join('');
            }

            // Show UI
            loader.style.display = 'none';
            mainContent.style.display = 'block';

        }, 1000); // 1s artificial delay for smooth transition and DB sync
    };

    function showError(msg) {
        loader.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
            <h2 style="color: #1e293b; margin-bottom: 0.5rem;">Access Denied</h2>
            <p style="color: #64748b; font-size: 0.9rem;">${msg}</p>
        `;
    }

    function escapeXml(unsafe) {
        if (!unsafe) return '';
        return unsafe.replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
        });
    }

    // Since customer portal shouldn't require login, we skip auth-guard redirect.
    // Ensure data is synced via Firebase read-only or permissive rules.
    window.addEventListener('dataUpdate', (e) => {
        if(e.detail.key === 'ALL') loadPortalData();
    });

    // If already offline-available
    if (localStorage.getItem(KEYS.INVENTORY)) {
        loadPortalData();
    }
});
