document.addEventListener('DOMContentLoaded', () => {
    // Check if user is admin
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'admin') {
        alert('Access denied. Admin only.');
        window.location.href = '/';
        return;
    }
    
    // Load users
    function loadUsers() {
        fetch('/api/users', {
            headers: getAuthHeaders()
        })
        .then(response => response.json())
        .then(users => {
            const usersTable = document.getElementById('users-table');
            usersTable.innerHTML = '';
            
            users.forEach(user => {
                const lastLogin = user.lastLogin ? 
                    new Date(user.lastLogin).toLocaleString() : 'Never';
                const statusBadge = user.isActive ? 
                    '<span class="badge bg-success">Active</span>' : 
                    '<span class="badge bg-danger">Inactive</span>';
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td><span class="badge bg-${user.role === 'admin' ? 'primary' : 'info'}">${user.role}</span></td>
                    <td>${statusBadge}</td>
                    <td>${lastLogin}</td>
                    <td>
                        <button class="btn btn-sm btn-warning" onclick="toggleUserStatus('${user._id}', ${user.isActive})">
                            ${user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        ${user.email !== 'boty@gmail.com' ? 
                            `<button class="btn btn-sm btn-danger" onclick="deleteUser('${user._id}')">Delete</button>` : 
                            '<span class="text-muted">Protected</span>'
                        }
                    </td>
                `;
                usersTable.appendChild(tr);
            });
        })
        .catch(error => console.error('Error loading users:', error));
    }
    
    // Load user activity
    function loadActivity() {
        fetch('/api/users/activity', {
            headers: getAuthHeaders()
        })
        .then(response => response.json())
        .then(activities => {
            const activityDiv = document.getElementById('user-activity');
            activityDiv.innerHTML = '';
            
            if (activities.length === 0) {
                activityDiv.innerHTML = '<p class="text-muted">No recent activity</p>';
                return;
            }
            
            activities.forEach(activity => {
                const div = document.createElement('div');
                div.className = 'mb-2 p-2 border-bottom';
                div.innerHTML = `
                    <strong>${activity.name}</strong> (${activity.role})<br>
                    <small class="text-muted">
                        ${new Date(activity.lastLogin).toLocaleString()}
                    </small>
                `;
                activityDiv.appendChild(div);
            });
        })
        .catch(error => console.error('Error loading activity:', error));
    }
    
    // Add user form
    document.getElementById('add-user-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const userData = {
            name: document.getElementById('user-name').value,
            email: document.getElementById('user-email').value,
            password: document.getElementById('user-password').value,
            role: document.getElementById('user-role').value
        };
        
        fetch('/api/users', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(userData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => Promise.reject(err));
            }
            return response.json();
        })
        .then(data => {
            alert('User created successfully!');
            document.getElementById('add-user-form').reset();
            loadUsers();
            loadActivity();
        })
        .catch(error => {
            alert(error.error || 'Error creating user');
        });
    });
    
    // Toggle user status
    window.toggleUserStatus = function(userId, currentStatus) {
        fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ isActive: !currentStatus })
        })
        .then(response => response.json())
        .then(data => {
            loadUsers();
        })
        .catch(error => {
            alert('Error updating user status');
        });
    };
    
    // Delete user
    window.deleteUser = function(userId) {
        if (confirm('Are you sure you want to delete this user?')) {
            fetch(`/api/users/${userId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            })
            .then(response => response.json())
            .then(data => {
                alert('User deleted successfully');
                loadUsers();
                loadActivity();
            })
            .catch(error => {
                alert('Error deleting user');
            });
        }
    };
    
    // Initial load
    loadUsers();
    loadActivity();
});