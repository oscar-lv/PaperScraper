const cheerio = require('cheerio');

function getArxivID(url) {
  const match = url.match(/arxiv\.org\/pdf\/(.+)\.pdf/);
  if (!match) {
    throw new Error('Invalid arXiv URL');
  }
  const arxivId = match[1];
  return arxivId;
}

function formatAuthorsList(authors, mode = 'arxiv') {
  if (mode == 'arxiv') {
    const formattedAuthors = authors.map((author) => {
      const names = author.split(' ');
      if (names.length === 1) {
        return `[[${names[0]}]]`;
      } else if (names.length === 2) {
        const formattedName =
          names[0].charAt(0).toUpperCase() +
          names[0].slice(1) +
          ' ' +
          names[1].charAt(0).toUpperCase() +
          names[1].slice(1);
        return `[[${formattedName}]]`;
      } else {
        const formattedName =
          names[0].charAt(0).toUpperCase() +
          names[0].slice(1) +
          ' ' +
          names[names.length - 1].charAt(0).toUpperCase() +
          names[names.length - 1].slice(1);
        return `[[${formattedName}]]`;
      }
    });
    return formattedAuthors.join(', ');
  } else if (mode == 'ssrn') {
    // In this case the list will come as ['Last, First', 'Last, First', ...], return formatted as [[First Last]], [[First Last]], ...
    const formattedAuthors = authors.map((author) => {
      const names = author.split(', ');
      if (names.length === 1) {
        return `[[${names[0]}]]`;
      } else {
        names[1] = names[1].split(' ')[0];
        const formattedName =
          names[1].charAt(0).toUpperCase() +
          names[1].slice(1) +
          ' ' +
          names[0].charAt(0).toUpperCase() +
          names[0].slice(1);
        return `[[${formattedName}]]`;
      }
    });
    return formattedAuthors.join(', ');
  }
}

function generateMarkdownTemplate(authors, date, abstract, mode = 'arxiv') {
  // Create an authorList variable, given a list of authors is a string #[[Author 1]], #[[Author 2]] etc
  const authorList = formatAuthorsList(authors, (mode = mode));

  const metadata = `- Metadata
      - **Publication Date**: ${date}
      - **Author**: ${authorList}
      - {{[[TODO]]}} [[Papers]]/[[Reading]] [[Topics]]: 
      - **Source**:`;

  const notes = `### Notes
      - **Abstract**
          - ${abstract}
      - **Introduction**`;

  const template = `${metadata}\n${notes}`;
  return template;
}

async function getArxivPaperInfo(arxivID) {
  const api_url = `https://export.arxiv.org/api/query?id_list=${arxivID}`;
  try {
    const response = await fetch(api_url);
    const data = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(data, 'text/xml');
    const entry = xml.getElementsByTagName('entry')[0];
    const title = entry.getElementsByTagName('title')[0].textContent;
    const abstract = entry.getElementsByTagName('summary')[0].textContent;
    const authorElements = entry.getElementsByTagName('author');
    const authors = [];
    for (let i = 0; i < authorElements.length; i++) {
      authors.push(
        authorElements[i].getElementsByTagName('name')[0].textContent
      );
    }
    const year = new Date(
      entry.getElementsByTagName('published')[0].textContent
    ).getFullYear();
    const metadata = generateMarkdownTemplate(
      authors,
      year,
      abstract.replace(/(\r\n|\n|\r)/gm, ''),
      'ssrn'
    );
    return [title + ', ' + authors[0] + ', ' + year, metadata, abstract];
  } catch (error) {
    return 'An error occurred while fetching paper information.';
  }
}

async function getSSRNPaperInfo(url) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('h1').text().trim();
    // Check if #abstract exists, if not, check if .abstract-text exists
    var abstract = $('#abstract').text().trim();
    if (abstract == '') {
      // get only paragraph text
      var abstract = $('.abstract-text p').text().trim();
    }
    const authors = $('meta[name="citation_author"]')
      .map((i, el) => $(el).attr('content'))
      .get();
    const date = $('meta[name="citation_publication_date"]').attr('content');
    const year = new Date(date).getFullYear();

    const metadata = generateMarkdownTemplate(
      authors,
      year,
      abstract.replace(/(\r\n|\n|\r)/gm, ''),
      (mode = 'ssrn')
    );
    return [title + ', ' + authors[0] + ', ' + year, metadata, abstract];
  } catch (error) {
    return 'An error occurred while fetching paper information.';
  }
}

document.addEventListener('DOMContentLoaded', function () {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var url = tabs[0].url;
    if (url.includes('arxiv.org')) {
      chrome.tabs.executeScript(
        tabs[0].id,
        { code: 'document.readyState' },
        function (result) {
          if (result && result[0] === 'complete') {
            var arxivID = getArxivID(url);
            getArxivPaperInfo(arxivID).then((info) => {
              document.getElementById('paper-title').textContent = info[0];
              document
                .getElementById('copy-title-btn')
                .addEventListener('click', function () {
                  navigator.clipboard.writeText(info[0]);
                });
              document.getElementById('markdown-template').textContent =
                info[2];

              document
                .getElementById('copy-template-btn')
                .addEventListener('click', function () {
                  navigator.clipboard.writeText(info[1]);
                });
            });
          } else {
            document.getElementById('paper-title').textContent =
              'Please wait for the page to finish loading.';
          }
        }
      );
    } else if (url.includes('papers.ssrn.com')) {
      chrome.tabs.executeScript(
        tabs[0].id,
        { code: 'document.readyState' },
        function (result) {
          if (result && result[0] === 'complete') {
            getSSRNPaperInfo(url).then((info) => {
              document.getElementById('paper-title').textContent = info[0];
              document
                .getElementById('copy-title-btn')
                .addEventListener('click', function () {
                  navigator.clipboard.writeText(info[0]);
                });
              document.getElementById('markdown-template').textContent =
                info[2];

              document
                .getElementById('copy-template-btn')
                .addEventListener('click', function () {
                  navigator.clipboard.writeText(info[1]);
                });
            });
          } else {
            document.getElementById('paper-title').textContent =
              'Please wait for the page to finish loading.';
          }
        }
      );
    } else {
      document.getElementById('paper-title').textContent =
        'This extension only works on arXiv and SSRN papers.';
    }
  });
});
