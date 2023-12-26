// List of common words to exclude
const stopwords = [
  'for', 'or', 'at', 'the', 'of', 'it', 'and', 'a', 'an', 'remote', 'year', 'to', 'is', 'in', 'i', 'as',
  'but', 'by', 'has', 'from', 'on', 'with', 'you', 'that', 'this', 'its', 's', 'n', 'not', ' this', 'be', 'which', 'use', 'each',
  'how', 'their', 'if', 'there', 'can', 'said', 'be',
  /* add more stopwords if needed */
];

// Function to save word cloud data to chrome.storage.local
function saveWordCloudData(wordList) {
  if (!wordList || wordList.length === 0) {
    console.error('wordList is empty or not defined.');
    return;
  }
  chrome.storage.local.set({ wordCloudData: JSON.stringify(wordList) }, function () {
    if (chrome.runtime.lastError) {
      console.error(`Error saving word cloud: ${chrome.runtime.lastError}`);
      return;
    }
    console.log('Word cloud data is saved');
  });
}

// Function to load word cloud data from chrome.storage.local
function loadWordCloudData(callback) {
  chrome.storage.local.get(['wordCloudData'], function (result) {
    if (chrome.runtime.lastError) {
      console.error(`Error loading word cloud: ${chrome.runtime.lastError}`);
      return;
    }
    if (result.wordCloudData) {
      console.log('Word cloud data is loaded');
      const wordList = JSON.parse(result.wordCloudData);
      if (wordList && wordList.length > 0) {
        callback(wordList);
      } else {
        console.log('No word cloud data to load.');
      }
    }
  });
}

// When the popup is opened, try to load and display the saved word cloud
document.addEventListener('DOMContentLoaded', function () {
  loadWordCloudData(function (wordList) {
    const maxWordCount = wordList.length > 0 ? Math.max(...wordList.map(word => word[1])) : 0;
    if (wordList && wordList.length > 0) {
      generateWordCloud(wordList, maxWordCount);
    }
  });
});

// Event listener for generating word cloud
document.getElementById('generateBtn').addEventListener('click', function () {
  const text = document.getElementById('textInput').value;
  if (text) {
    const wordList = generateWordListFromText(text); // Generate word list from text
    const maxWordCount = wordList.length > 0 ? Math.max(...wordList.map(word => word[1])) : 0;
    saveWordCloudData(wordList); // Save the word list
    generateWordCloud(wordList, maxWordCount); // Generate word cloud
  } else {
    alert('Please paste some text.');
  }
});

// Function to generate a word list from text
function generateWordListFromText(text) {
  const wordCounts = {};
  text
    .replace(/[^\w\s]/g, '') // Remove non-alphanumeric characters
    .split(/\s+/)
    .map(word => word.toLowerCase()) // Convert to lower case
    .filter(word => !stopwords.includes(word) && word.length > 0) // Filter out stop words and empty strings
    .forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });

  return Object.keys(wordCounts).map(word => [word, wordCounts[word]]).sort((a, b) => b[1] - a[1]);
}

// Function to generate the word cloud with more balanced sizes
function generateWordCloud(wordList, maxWordCount) {
  if (!wordList || wordList.length === 0) {
    console.error('wordList is empty or not defined. Cannot generate word cloud.');
    return;
  }

  const wordCloudContainer = document.getElementById('wordCloudContainer');
  wordCloudContainer.innerHTML = ''; // Clear the previous word cloud

  WordCloud(wordCloudContainer, {
    list: wordList,
    gridSize: Math.round(16 * wordCloudContainer.offsetWidth / 1024),
    weightFactor: size => (size / maxWordCount) * 50,
    fontFamily: 'Times, serif',
    color: 'random-dark',
    rotateRatio: 0,
    rotationSteps: 2,
    backgroundColor: '#ffffff',
  });
}
