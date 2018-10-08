import run from '../index';

const script = `

[1, @now]

`;

run(script, x => console.log(JSON.stringify(x, null, 2)));
