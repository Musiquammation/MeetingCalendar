// Main initialization
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
});

// Prevent default drag behavior on document
document.addEventListener('mouseup', () => {
    state.isSelecting = false;
    state.selectedCells.forEach(cell => cell.classList.remove('selecting'));
    state.selectedCells = [];
});