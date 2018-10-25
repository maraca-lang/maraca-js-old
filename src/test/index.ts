// import run from '../index';

// import convert from './convert';
// import render from './render';

// const data = [
//   {
//     'First name': 'Hayden',
//     'Last name': 'Zieme',
//     DOB: '1997-03-14T22:12:47.904Z',
//     'Score 1': 93255,
//     'Score 2': 11,
//   },
//   {
//     'First name': 'Branson',
//     'Last name': 'Gutkowski',
//     DOB: '1988-11-04T23:38:30.204Z',
//     'Score 1': 14675,
//     'Score 2': 23608,
//   },
//   {
//     'First name': 'Audrey',
//     'Last name': 'Huels',
//     DOB: '2013-03-18T22:18:19.507Z',
//     'Score 1': 38791,
//     'Score 2': 34556,
//   },
//   {
//     'First name': 'Marcellus',
//     'Last name': 'Hyatt',
//     DOB: '1990-10-01T07:49:15.128Z',
//     'Score 1': 53881,
//     'Score 2': 84631,
//   },
//   {
//     'First name': 'Heather',
//     'Last name': 'Hahn',
//     DOB: '1998-04-03T07:48:15.492Z',
//     'Score 1': 52454,
//     'Score 2': 20445,
//   },
//   {
//     'First name': 'Immanuel',
//     'Last name': 'Thiel',
//     DOB: '2011-11-30T14:35:43.900Z',
//     'Score 1': 2738,
//     'Score 2': 53441,
//   },
//   {
//     'First name': 'Marco',
//     'Last name': 'Volkman',
//     DOB: '2006-04-14T23:47:11.160Z',
//     'Score 1': 45720,
//     'Score 2': 55868,
//   },
//   {
//     'First name': 'Hipolito',
//     'Last name': 'Connelly',
//     DOB: '1990-08-23T00:42:16.719Z',
//     'Score 1': 19810,
//     'Score 2': 77838,
//   },
//   {
//     'First name': 'Precious',
//     'Last name': 'Rau',
//     DOB: '1989-10-08T00:20:53.097Z',
//     'Score 1': 80275,
//     'Score 2': 31342,
//   },
//   {
//     'First name': 'Augusta',
//     'Last name': 'Pouros',
//     DOB: '2003-04-06T16:59:57.696Z',
//     'Score 1': 87638,
//     'Score 2': 86502,
//   },
//   {
//     'First name': 'Soledad',
//     'Last name': 'Simonis',
//     DOB: '2016-03-31T05:52:16.688Z',
//     'Score 1': 82960,
//     'Score 2': 3905,
//   },
//   {
//     'First name': 'Dorcas',
//     'Last name': 'Dach',
//     DOB: '2017-01-07T18:22:36.169Z',
//     'Score 1': 87814,
//     'Score 2': 67052,
//   },
//   {
//     'First name': 'Ayden',
//     'Last name': 'Medhurst',
//     DOB: '2006-03-04T08:24:22.640Z',
//     'Score 1': 67165,
//     'Score 2': 95788,
//   },
//   {
//     'First name': 'Hannah',
//     'Last name': 'Lemke',
//     DOB: '2012-11-15T07:06:50.859Z',
//     'Score 1': 69187,
//     'Score 2': 28962,
//   },
//   {
//     'First name': 'Emerson',
//     'Last name': 'Conroy',
//     DOB: '1998-03-20T07:02:45.913Z',
//     'Score 1': 78331,
//     'Score 2': 83462,
//   },
//   {
//     'First name': 'Hardy',
//     'Last name': 'Auer',
//     DOB: '2017-10-09T07:16:07.060Z',
//     'Score 1': 75014,
//     'Score 2': 62402,
//   },
//   {
//     'First name': 'Yasmin',
//     'Last name': 'Olson',
//     DOB: '1996-05-14T01:33:19.685Z',
//     'Score 1': 29849,
//     'Score 2': 28044,
//   },
//   {
//     'First name': 'Isabell',
//     'Last name': 'Schamberger',
//     DOB: '2012-02-20T05:09:27.486Z',
//     'Score 1': 10322,
//     'Score 2': 7336,
//   },
//   {
//     'First name': 'Isai',
//     'Last name': 'Koss',
//     DOB: '1991-07-23T08:35:26.047Z',
//     'Score 1': 9617,
//     'Score 2': 29361,
//   },
//   {
//     'First name': 'Stewart',
//     'Last name': 'Grant',
//     DOB: '2015-03-20T01:23:32.711Z',
//     'Score 1': 13002,
//     'Score 2': 52479,
//   },
//   {
//     'First name': 'Aimee',
//     'Last name': 'Boehm',
//     DOB: '1998-06-12T05:30:41.962Z',
//     'Score 1': 91686,
//     'Score 2': 21162,
//   },
//   {
//     'First name': 'Talia',
//     'Last name': 'Gislason',
//     DOB: '2009-11-01T04:39:21.012Z',
//     'Score 1': 49157,
//     'Score 2': 58438,
//   },
//   {
//     'First name': 'Amir',
//     'Last name': 'Mann',
//     DOB: '2001-08-01T21:22:55.201Z',
//     'Score 1': 61393,
//     'Score 2': 14672,
//   },
//   {
//     'First name': 'Vern',
//     'Last name': 'McKenzie',
//     DOB: '2010-12-21T18:12:45.561Z',
//     'Score 1': 69975,
//     'Score 2': 23101,
//   },
//   {
//     'First name': 'Bartholome',
//     'Last name': 'Lemke',
//     DOB: '2006-05-20T13:34:33.097Z',
//     'Score 1': 94993,
//     'Score 2': 69440,
//   },
//   {
//     'First name': 'Jeramy',
//     'Last name': 'Jerde',
//     DOB: '2002-08-03T21:40:31.515Z',
//     'Score 1': 4995,
//     'Score 2': 76548,
//   },
//   {
//     'First name': 'Kailee',
//     'Last name': 'Bayer',
//     DOB: '1998-11-23T22:15:19.305Z',
//     'Score 1': 13996,
//     'Score 2': 51488,
//   },
//   {
//     'First name': 'Payton',
//     'Last name': 'Welch',
//     DOB: '2017-11-26T03:41:29.278Z',
//     'Score 1': 58655,
//     'Score 2': 88312,
//   },
//   {
//     'First name': 'Stewart',
//     'Last name': 'Lindgren',
//     DOB: '2014-09-04T03:08:13.445Z',
//     'Score 1': 44798,
//     'Score 2': 13927,
//   },
//   {
//     'First name': 'Simeon',
//     'Last name': 'Schoen',
//     DOB: '2007-06-23T22:19:23.106Z',
//     'Score 1': 39767,
//     'Score 2': 53842,
//   },
// ];

// document.querySelectorAll<HTMLElement>('[data-maraca]').forEach(elem => {
//   const script = elem.textContent;
//   elem.textContent = '';
//   elem.style.display = 'block';
//   run(script, convert({ data }), data =>
//     render(elem, elem.childNodes[0], data),
//   );
// });
