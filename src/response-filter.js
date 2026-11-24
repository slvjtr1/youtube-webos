import { core } from './core-runtime';
import './config';
import { filterResponse } from './response-host';

const parse = JSON.parse;
JSON.parse = function (text, reviver) {
  return filterResponse(core, parse(text, reviver));
};
