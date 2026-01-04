const { ipcRenderer } = require('electron');

// DOM Elements
const tabs = document.querySelectorAll('.tab');
const sourceGrid = document.getElementById('sourceGrid');
const cancelBtn = document.getElementById('cancelBtn');
const shareBtn = document.getElementById('shareBtn');

// State
let allSources = [];
let selectedSource = null;
let currentTab = 'screen';

// Initialize
async function init() {
  // Set up event listeners
  tabs.forEach(tab => tab.addEventListener('click', handleTabClick));
  cancelBtn.addEventListener('click', handleCancel);
  shareBtn.addEventListener('click', handleShare);
  
  // Listen for screen sources from main process
  ipcRenderer.on('screen-sources', (event, sources) => {
    console.log('Received screen sources:', sources);
    allSources = sources;
    renderSources();
  });
  
  // Request screen sources from main process
  ipcRenderer.send('request-sources');
}

// Handle tab click
function handleTabClick(event) {
  // Update active tab
  tabs.forEach(tab => tab.classList.remove('active'));
  event.target.classList.add('active');
  
  // Update current tab
  currentTab = event.target.dataset.type;
  
  // Re-render sources
  renderSources();
}

// Render sources based on current tab
function renderSources() {
  // Clear current sources
  sourceGrid.innerHTML = '';
  
  // Filter sources based on current tab
  const filteredSources = allSources.filter(source => {
    if (currentTab === 'window') {
      return source.type === 'window' || (source.id && source.id.startsWith('window'));
    } else if (currentTab === 'screen') {
      return source.type === 'screen' || (source.id && source.id.startsWith('screen'));
    }
    return true;
  });
  // console.log('renderSources~1', allSources, filteredSources)
  // Render filtered sources
  filteredSources.forEach(source => {
    const sourceItem = createSourceItem(source);
    sourceGrid.appendChild(sourceItem);
  });
  
  // console.log('renderSources~2', sourceGrid)
  // Clear selected source if it's no longer in the filtered list
  if (selectedSource && !filteredSources.find(s => s.id === selectedSource.id)) {
    selectedSource = null;
    shareBtn.disabled = true;
  }
}

// Create source item element
function createSourceItem(source) {
  const item = document.createElement('div');
  item.className = 'source-item';
  item.dataset.sourceId = source.id;
  
  // Check if this source is already selected
  if (selectedSource && selectedSource.id === source.id) {
    item.classList.add('selected');
  }
  
  // Create thumbnail container
  const thumbnailContainer = document.createElement('div');
  thumbnailContainer.className = 'source-thumbnail';

  // console.log('createSourceItem')

  // Create thumbnail image
  const thumbnail = document.createElement('img');
  thumbnail.src = source.thumbnail.toDataURL();
  thumbnail.alt = source.name;
  thumbnailContainer.appendChild(thumbnail);
  // console.log('createSourceItem', source)
  
  // Create source name
  const sourceName = document.createElement('div');
  sourceName.className = 'source-name';
  sourceName.textContent = source.name;
  
  // Assemble item
  item.appendChild(thumbnailContainer);
  item.appendChild(sourceName);
  
  // Add click event listener
  item.addEventListener('click', () => handleSourceSelect(source, item));
  
  return item;
}

// Handle source selection
function handleSourceSelect(source, element) {
  // Update selected source
  selectedSource = source;
  
  // Update UI
  document.querySelectorAll('.source-item').forEach(item => {
    item.classList.remove('selected');
  });
  element.classList.add('selected');
  
  // Enable share button
  shareBtn.disabled = false;
}

// Handle cancel
function handleCancel() {
  ipcRenderer.send('screen-select-cancel');
}

// Handle share
function handleShare() {
  if (selectedSource) {
    ipcRenderer.send('screen-select-confirm', selectedSource);
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', init);