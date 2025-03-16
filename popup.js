// Comprehensive list of stop words
const stopwords = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can\'t', 'cannot', 'could',
  'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 'each', 'few', 'for',
  'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll',
  'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d',
  'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me',
  'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
  'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s',
  'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this',
  'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll',
  'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which',
  'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d',
  'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

// Function to check if wordcloud2.js is loaded
function isWordCloudLoaded() {
  return typeof WordCloud === 'function';
}

// Function to show status message
function showStatus(message, isError = false) {
  const statusElement = document.getElementById('status');
  statusElement.textContent = message;
  statusElement.className = `status-message ${isError ? 'error' : 'success'}`;
  setTimeout(() => {
    statusElement.textContent = '';
    statusElement.className = 'status-message';
  }, 3000);
}

// Function to clean and normalize text
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/['']s\b/g, '')  // Remove possessives
    .replace(/[""'']/g, '')   // Remove quotes
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '') // Remove punctuation
    .replace(/\s{2,}/g, ' '); // Remove extra spaces
}

// Function to stem words
function stemWord(word) {
  const rules = [
    [/ing$/, ''],
    [/ed$/, ''],
    [/s$/, ''],
    [/ly$/, ''],
    [/ment$/, ''],
    [/ness$/, ''],
    [/ful$/, ''],
    [/able$/, ''],
    [/ible$/, ''],
    [/ion$/, ''],
    [/tion$/, ''],
    [/ation$/, ''],
    [/ies$/, 'y'],
    [/es$/, '']
  ];

  let stemmed = word;
  for (const [pattern, replacement] of rules) {
    if (word.length > 4 && pattern.test(word)) {
      const newWord = word.replace(pattern, replacement);
      if (newWord.length > 2) {
        stemmed = newWord;
        break;
      }
    }
  }
  return stemmed;
}

// Function to generate word list from text
function generateWordListFromText(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text must be a non-empty string');
  }

  const wordLimit = parseInt(document.getElementById('wordLimit').value);
  if (isNaN(wordLimit) || wordLimit < 1) {
    throw new Error('Invalid word limit value');
  }

  const wordCounts = new Map();
  const normalizedText = normalizeText(text);
  
  normalizedText
    .split(/\s+/)
    .filter(word => {
      return word.length > 1 && // Filter out single characters
             !stopwords.has(word) && // Filter out stop words
             !/^\d+$/.test(word) && // Filter out pure numbers
             !/^[^a-zA-Z]+$/.test(word); // Must contain at least one letter
    })
    .map(word => stemWord(word))
    .forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

  if (wordCounts.size === 0) {
    throw new Error('No valid words found in the text');
  }

  // Convert to array and sort by frequency
  return Array.from(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, wordLimit);
}

// Function to generate the word cloud
function generateWordCloud(wordList, maxWordCount) {
  if (!isWordCloudLoaded()) {
    showStatus('Word cloud library not loaded. Please refresh the page.', true);
    return;
  }

  if (!wordList || wordList.length === 0) {
    showStatus('No words to display in the cloud.', true);
    return;
  }

  const wordCloudContainer = document.getElementById('wordCloudContainer');
  
  // Remove any existing canvas
  const existingCanvas = document.getElementById('wordCloudCanvas');
  if (existingCanvas) {
    existingCanvas.remove();
  }

  // Create new canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'wordCloudCanvas';
  
  // Get container dimensions
  const containerRect = wordCloudContainer.getBoundingClientRect();
  const containerWidth = containerRect.width - 48; // Account for padding
  const containerHeight = containerRect.height - 48;
  
  // Calculate dimensions based on orientation
  const orientation = document.getElementById('orientation').value;
  let width, height;
  
  if (orientation === 'horizontal') {
    // 16:9 aspect ratio for horizontal
    height = Math.min(containerHeight, containerWidth * 0.5625);
    width = height * 1.778;
  } else if (orientation === 'vertical') {
    // 9:16 aspect ratio for vertical
    width = Math.min(containerWidth, containerHeight * 0.5625);
    height = width * 1.778;
  } else {
    // Square 1:1 aspect ratio
    const size = Math.min(containerWidth, containerHeight);
    width = size;
    height = size;
  }
  
  canvas.width = width;
  canvas.height = height;
  
  // Set CSS dimensions to maintain aspect ratio
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  
  wordCloudContainer.appendChild(canvas);
  wordCloudContainer.classList.add('has-canvas');

  // Color schemes
  const colorSchemes = {
    blue: ['#225588', '#4477AA', '#6699CC', '#88BBDD', '#AAD4FF'],
    green: ['#226622', '#448844', '#66AA66', '#88CC88', '#AAFFAA'],
    purple: ['#662266', '#884488', '#AA66AA', '#CC88CC', '#FFAAFF']
  };

  const selectedScheme = colorSchemes[document.getElementById('colorScheme').value] || colorSchemes.blue;

  // Get background color
  const backgroundColors = {
    transparent: 'transparent',
    white: '#ffffff',
    gray: '#f0f0f0',
    black: '#000000'
  };
  const backgroundColor = backgroundColors[document.getElementById('backgroundColor').value] || 'transparent';

  // Adjust word sizes based on canvas dimensions
  const maxSize = Math.min(width, height) / 5;
  const minSize = 14;
  const sizeRange = maxSize - minSize;

  // Scale word sizes
  const scaledList = wordList.map(([word, count]) => {
    const size = minSize + (count / maxWordCount) * sizeRange;
    return [word, size];
  });

  // Adjust text color for dark background
  const isDarkBackground = backgroundColor === '#000000';
  const defaultColor = isDarkBackground ? '#ffffff' : selectedScheme[0];

  // Generate word cloud with optimized settings
  WordCloud(canvas, {
    list: scaledList,
    gridSize: Math.round(16 * width / 1024),
    weightFactor: 1,
    fontFamily: 'Arial, Helvetica, sans-serif',
    color: (word, weight, fontSize) => {
      if (isDarkBackground) {
        const index = Math.floor((fontSize / maxSize) * (selectedScheme.length - 1));
        const color = selectedScheme[index] || selectedScheme[0];
        return lightenColor(color);
      }
      const index = Math.floor((fontSize / maxSize) * (selectedScheme.length - 1));
      return selectedScheme[index] || selectedScheme[0];
    },
    rotateRatio: 0.1,
    rotationSteps: 2,
    drawOutOfBound: false,
    shrinkToFit: true,
    clearCanvas: true,
    wait: 50,
    abort: () => false,
    minSize: minSize,
    shape: 'square', // Always use square shape for better word placement
    ellipticity: orientation === 'vertical' ? 1.6 : (orientation === 'horizontal' ? 0.625 : 1),
    backgroundColor: backgroundColor
  });

  // Add error handling
  canvas.onerror = function() {
    showStatus('Error generating word cloud. Trying with simplified settings...', true);
    WordCloud(canvas, {
      list: scaledList.slice(0, Math.min(wordList.length, 20)),
      gridSize: 20,
      weightFactor: 1,
      fontFamily: 'Arial',
      color: defaultColor,
      rotateRatio: 0,
      drawOutOfBound: false,
      shrinkToFit: true,
      shape: 'square',
      ellipticity: orientation === 'vertical' ? 1.6 : (orientation === 'horizontal' ? 0.625 : 1),
      backgroundColor: backgroundColor
    });
  };
}

// Helper function to lighten colors for dark background
function lightenColor(color) {
  // Convert hex to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Lighten by mixing with white
  const lightenAmount = 0.4;
  const newR = Math.round(r + (255 - r) * lightenAmount);
  const newG = Math.round(g + (255 - g) * lightenAmount);
  const newB = Math.round(b + (255 - b) * lightenAmount);
  
  // Convert back to hex
  return `#${(newR).toString(16).padStart(2, '0')}${(newG).toString(16).padStart(2, '0')}${(newB).toString(16).padStart(2, '0')}`;
}

// Function to extract text from webpage
async function getPageText() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if the URL is restricted
    if (!tab?.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
      throw new Error('Cannot access browser system pages. Please try on a regular webpage.');
    }
    
    const [{result}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        const scripts = document.getElementsByTagName('script');
        const styles = document.getElementsByTagName('style');
        for (const element of [...scripts, ...styles]) {
          element.remove();
        }
        
        return Array.from(document.body.getElementsByTagName('*'))
          .map(element => {
            const style = window.getComputedStyle(element);
            const isHidden = style.display === 'none' || style.visibility === 'hidden';
            return isHidden ? '' : element.textContent;
          })
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    });
    
    if (!result) {
      throw new Error('No text found on the page');
    }
    
    return result;
  } catch (error) {
    if (error.message.includes('Cannot access browser system pages')) {
      showStatus(error.message, true);
    } else {
      showStatus('Error getting page text. Make sure you\'re on a regular webpage.', true);
    }
    throw error;
  }
}

// Event listener for grab text button
document.getElementById('grabTextBtn').addEventListener('click', async function() {
  try {
    showStatus('Getting text from page...');
    const text = await getPageText();
    document.getElementById('textInput').value = text;
    showStatus('Text retrieved successfully!');
  } catch (error) {
    console.error('Error:', error);
  }
});

// Event listener for generating word cloud
document.getElementById('generateBtn').addEventListener('click', function() {
  const text = document.getElementById('textInput').value;
  if (!text) {
    showStatus('Please paste some text first.', true);
    return;
  }

  try {
    const wordList = generateWordListFromText(text);
    const maxWordCount = Math.max(...wordList.map(word => word[1]));
    generateWordCloud(wordList, maxWordCount);
    showStatus('Word cloud generated successfully!');
  } catch (error) {
    console.error('Error generating word cloud:', error);
    showStatus(error.message || 'Error generating word cloud. Please try again.', true);
  }
});

// Event listener for downloading word cloud
document.getElementById('downloadBtn').addEventListener('click', function() {
  const canvas = document.getElementById('wordCloudCanvas');
  if (!canvas) {
    showStatus('Please generate a word cloud first.', true);
    return;
  }

  try {
    canvas.toBlob(function(blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'wordcloud.png';
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
    
    showStatus('Word cloud downloaded successfully!');
  } catch (error) {
    console.error('Error downloading word cloud:', error);
    showStatus('Error downloading word cloud. Please try again.', true);
  }
});

// Initialize the extension
document.addEventListener('DOMContentLoaded', function() {
  // Check if the word cloud library is loaded
  if (!isWordCloudLoaded()) {
    showStatus('Word cloud library not loaded. Please refresh the page.', true);
    return;
  }

  document.getElementById('colorScheme').value = 'blue';
  document.getElementById('wordLimit').value = '30';
});
