const rows = [
  ['ignored', 'Dog, Current', 'Labrador', '16/09/2026', '19/09/2026', 'Owner Current', '0400000001', '2', '0', 'Current note, quoted', 'https://example.test/edit/current', 'Boarding'],
  ['ignored', 'Dog Upcoming', 'Poodle', '20/09/2026', '22/09/2026', 'Owner Upcoming', '0400000002', '0', '1', 'Upcoming', '', 'Boarding'],
  ['ignored', 'Dog Departed', 'Beagle', '10/09/2026', '15/09/2026', 'Owner Departed', '0400000003', '1', '0', 'Departed', '', 'Boarding'],
  ['ignored', 'Dog One & Dog Two', 'Mixed', '18/09/2026', '21/09/2026', 'Owner Multi', '0400000004', '0', '0', 'Multi dog', '', 'Boarding'],
  ['ignored', 'Meet Dog', 'Spaniel', '17/09/2026 10:30', '17/09/2026', 'Owner Meet', '0400000005', '0', '0', 'Meet & Greet: 10:30', '', 'Meet & Greet'],
  ['ignored', 'Potential Dog', 'Kelpie', '24/09/2026', '27/09/2026', 'Owner Potential', '0400000006', '0', '0', 'Potential request', '', 'Potential Stay']
];
// Keep the fixture representative enough to exercise the real month grid and
// the long Home view at phone heights. These are distinct, valid stays rather
// than synthetic spacer elements.
const denseRows = Array.from({ length: 14 }, (_, index) => {
  const day = String(18 + (index % 10)).padStart(2, '0');
  const end = String(20 + (index % 10)).padStart(2, '0');
  const type = index % 3 === 0 ? 'Potential Stay' : 'Boarding';
  return ['ignored', `Fixture Dog ${index + 1}`, 'Mixed', `${day}/09/2026`, `${end}/09/2026`, `Fixture Owner ${index + 1}`, `04000000${20 + index}`, '0', '0', 'Baseline fixture stay', '', type];
});
function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
const csv = [
  ['Timestamp', 'Dog Name', 'Breed', 'Start Date', 'End Date', 'Owner Name', 'Phone', 'Likes', 'Dislikes', 'Notes', 'Edit Link', 'Booking Type'],
  ...rows,
  ...denseRows
].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
module.exports = { csv, rows };
