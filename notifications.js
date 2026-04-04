document.addEventListener('DOMContentLoaded', () => {
    const notifBell = document.getElementById('notifBell');
    const notifDropdown = document.getElementById('notifDropdown');
    const notifList = document.getElementById('notifList');
    const notifBadge = document.getElementById('notifBadge');

    // Toggle Dropdown
    notifBell.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdown.classList.toggle('active');
    });

    document.addEventListener('click', () => {
        notifDropdown.classList.remove('active');
    });

    notifDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    const checkNotifications = () => {
        const notifications = [];

        // 1. Check Low Stock
        const inventory = JSON.parse(localStorage.getItem('hardware_sync_inventory')) || [];
        inventory.forEach(item => {
            if (item.qty < (item.minStock || 5)) {
                notifications.push({
                    type: 'low-stock',
                    icon: 'fa-triangle-exclamation',
                    title: 'Low Stock Alert',
                    desc: `${item.name} is low (${item.qty} left).`
                });
            }
        });

        // 2. Check AMC Expiry (< 7 days)
        const amcData = JSON.parse(localStorage.getItem('hardware_sync_amc')) || [];
        const today = new Date();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(today.getDate() + 7);

        amcData.forEach(amc => {
            const endDate = new Date(amc.endDate);
            if (endDate > today && endDate <= sevenDaysFromNow) {
                notifications.push({
                    type: 'amc-expiry',
                    icon: 'fa-calendar-day',
                    title: 'AMC Expiring Soon',
                    desc: `${amc.orgName} contract ends on ${amc.endDate}.`
                });
            } else if (endDate <= today) {
                notifications.push({
                    type: 'amc-expiry',
                    icon: 'fa-calendar-xmark',
                    title: 'AMC Expired',
                    desc: `${amc.orgName} contract has expired.`
                });
            }
        });

        // 3. Check Stale Repairs (> 3 days)
        const repairJobs = JSON.parse(localStorage.getItem('tally_repair_jobs')) || [];
        repairJobs.forEach(job => {
            if (job.status === 'Pending') {
                // job.createdAt format is "DD/MM/YYYY, HH:MM:SS" or similar, depends on locale
                // We'll try to parse it safely or use the timestamp from the ID if needed
                let createdDate;
                try {
                    // Try parsing the ID suffix if it's job_TIMESTAMP
                    const ts = parseInt(job.id.split('_')[1]);
                    createdDate = new Date(ts);
                } catch (e) {
                    createdDate = new Date(job.createdAt);
                }

                const diffDays = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));
                if (diffDays >= 3) {
                    notifications.push({
                        type: 'stale-repair',
                        icon: 'fa-clock',
                        title: 'Delayed Repair',
                        desc: `${job.customerName}'s ${job.deviceType} is pending for ${diffDays} days.`
                    });
                }
            }
        });

        renderNotifications(notifications);
    };

    const renderNotifications = (notifications) => {
        notifList.innerHTML = '';
        
        if (notifications.length === 0) {
            notifBadge.style.display = 'none';
            notifList.innerHTML = '<div class="notification-empty">No new alerts.</div>';
            return;
        }

        notifBadge.textContent = notifications.length;
        notifBadge.style.display = 'block';

        notifications.forEach(notif => {
            const item = document.createElement('div');
            item.className = `notification-item ${notif.type}`;
            item.innerHTML = `
                <i class="fa-solid ${notif.icon}"></i>
                <div class="notification-item-content">
                    <div class="notification-title">${notif.title}</div>
                    <div class="notification-desc">${notif.desc}</div>
                </div>
            `;
            notifList.appendChild(item);
        });
    };

    // Initial Check
    checkNotifications();
    
    // Check every hour
    setInterval(checkNotifications, 3600000);
});
