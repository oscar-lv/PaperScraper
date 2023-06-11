const fetch = require('node-fetch');
const cheerio = require('cheerio');

const url = 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=702281';

function scrapePaperMetadata(url) {
  return fetch(url)
    .then((res) => res.text())
    .then((html) => {
      // Load the HTML into a Cheerio object
      const $ = cheerio.load(html);

      // Extract the title of the paper
      const title = $('h1').text().trim();

      // Extract the abstract of the paper
      const abstract = $('.abstract-text')
        .text()
        .trim()
        .replace(/^Abstract\s+/i, '');

      // Extract the authors of the paper
      const authors = $('meta[name="citation_author"]')
        .map((i, el) => $(el).attr('content'))
        .get();

      // Extract the date of the paper
      const date = Date(
        $('meta[name="citation_publication_date"]').attr('content')
      );

      return {
        title,
        abstract,
        authors,
        date,
      };
    })
    .catch((err) => console.error(err));
}

// Example usage
scrapePaperMetadata(url)
  .then((metadata) => {
    console.log('Title:', metadata.title);
    console.log('Abstract:', metadata.abstract);
    console.log('Authors:', metadata.authors);
    console.log('Date:', metadata.date);
  })
  .catch((err) => console.error(err));
