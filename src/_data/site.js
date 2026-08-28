export default {
  title: 'Fictional Healing',
  host: 'https://www.fictionalhealing.be',
  subtitle: 'Iconographic Database',
  description: 'A research-oriented catalogue for browsing historical imagery, iconography, subjects, and related visual motifs.',
  collectionName: 'metadata',
  ui: {
    emptyValue: '-'
  },
  taxonomies: [
    { key: 'subjects', label: 'Subjects', singular: 'Subject', field: 'subject', aliases: ['subject', 'subjects'], data: 'subjects', url: '/subjects/' },
    { key: 'locations', label: 'Place of origin', singular: 'Location', field: 'place_creation', aliases: ['place_creation', 'location'], data: 'locations', url: '/locations/' }
  ]
};
