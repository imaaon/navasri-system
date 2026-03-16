// ===== GLOBAL EVENT LISTENERS =====

// Auto-calculate age when dob changes
document.addEventListener('change', function(e) {
  if (e.target.id === 'pat-dob') {
    const age = e.target.value ? calcAge(e.target.value) : '-';
    document.getElementById('pat-age-display').value = age;
  }
  if (e.target.id === 'staff-dob') {
    const age = e.target.value ? calcAge(e.target.value) : '-';
    document.getElementById('staff-age-display').value = age;
  }
});