var path  = require('path'),
    fs    = require('fs'),
    sys   = require('sys');

// the state machine
exports.parseStr = ejs_parseStr;
function ejs_parseStr (src, filename) {
  var safeName = path.basename(filename).replace(/[^a-zA-Z0-9_]/g, '_'),

    STATE_JS = "STATE_JS",
    STATE_JS_CODE = "STATE_JS_CODE",
    STATE_JS_PRINT = "STATE_JS_PRINT",
    STATE_JS_PRINT_START = "STATE_JS_PRINT_START",
    STATE_HTML = "STATE_HTML",

    STATE_NO_STR = "STATE_NO_STR",
    STATE_STR1 = "STATE_STR1",
    STATE_STR2 = "STATE_STR2",

    STATE_NO_COMMENT = "STATE_NO_COMMENT",
    STATE_LINECOM = "STATE_LINECOM",
    STATE_BLOCKCOM = "STATE_BLOCKCOM",

    // STATE_NO_REGEX = "STATE_NO_REGEX",
    // STATE_REGEX = "STATE_REGEX",

    STATE_NO_SLASH = "STATE_NO_SLASH",
    STATE_SLASH_START = "STATE_SLASH_START",

    escaped = false,
    state = STATE_HTML,
    slash_state = STATE_NO_SLASH,
    str_state = STATE_NO_STR,
    com_state = STATE_NO_COMMENT,

    CHR_SLASH = "/",
    CHR_STR1 = "'",
    CHR_STR2 = '"',
    CHR_OPEN = '<',
    CHR_PCT = '%',
    CHR_CLOSE = '>',
    CHR_EQ = '=',
    CHR_ESC = '\\',
    CHR_STAR = "*",
    CHR_CR = "\n",

    EOF, // undefined, when it falls off the end of the buffer

    // put enough \n's in front of the raw strings so that the line numbers are consistent.
    cr_count = 0,

    // The buffer that stores the HTML when we're in STATE_HTML
    html_buffer = [];

    // just split, since arrays are more better for this.
    // we're going to end up with an array of output, and then JSON.stringify()
    // it at the end.
    arr = src.split(""),

    // the output buffer, where the code goes as it's parsed.
    out = [
      "(function wrap_", safeName, " (require) {",
      "var __filename=", JSON.stringify(filename), ";",
      "return function parsed_", safeName, " (print) {",
      "print = print || process.stdio.write; "
    ],

    FINISH = "}})";

  for ( var i = 0, l = arr.length; i <= l; i ++ ) {
    var c = arr[i];
    if (state === STATE_HTML) {
      // check to see if it's time to switch out.
      if (
        c === EOF ||
        c === CHR_PCT && html_buffer[html_buffer.length - 1] === CHR_OPEN
      ) {
        state = STATE_JS;
        if (c !== EOF) {
          // pop the '<' off the html_buffer, since we don't want to print that
          html_buffer.pop();
        }
        while (cr_count > 0) {
          out.push(CHR_CR);
          cr_count --;
        }
        if (html_buffer.length) {
          out.push(';print(', JSON.stringify(html_buffer.join("")), ');');
        }
        html_buffer = [];
      } else {
        if (c === CHR_CR) cr_count ++;
        html_buffer.push(c);
      }
    } else if ( state === STATE_JS && c !== EOF ) {
      if (c === CHR_EQ) {
        state = STATE_JS_PRINT_START;
      } else {
        state = STATE_JS_CODE;
      }
      // back up a char so that we can process this.
      // that's so that we don't bork on <%%> 
      i --;
    } else if (state === STATE_JS_PRINT_START && c !== EOF) {
      out.push("print(");
      state = STATE_JS_PRINT;
    } else if (str_state === STATE_STR1 && c !== EOF) {
      if (c === CHR_ESC || escaped) {
        escaped = !escaped;
      } else if ( c === CHR_STR1 ) {
        str_state = STATE_NO_STR;
      }
      out.push(c);
    } else if (str_state === STATE_STR2 && c !== EOF) {
      if (c === CHR_ESC || escaped) {
        escaped = !escaped;
      } else if ( c === CHR_STR2 ) {
        str_state = STATE_NO_STR;
      }
      out.push(c);
    } else if (com_state === STATE_BLOCKCOM && c !== EOF) {
      if (c === CHR_SLASH && out[out.length-1] == CHR_STAR) {
        com_state = STATE_NO_COMMENT;
      }
      out.push(c);
    } else if (slash_state === STATE_SLASH_START) {
      slash_state = STATE_NO_SLASH;
      if (c === CHR_SLASH) {
        com_state = STATE_LINECOM;
        out.pop();
      } else if (c === CHR_STAR) {
        com_state = STATE_BLOCKCOM;
        out.push(c);
      } else if (c !== EOF) {
        out.push(c);
      }
    } else if (c === CHR_SLASH) {
      slash_state = STATE_SLASH_START;
      out.push(c);
    } else if ( c === CHR_STR2 && com_state === STATE_NO_COMMENT) {
      str_state = STATE_STR2;
      out.push(c);
    } else if ( c === CHR_STR1 && com_state === STATE_NO_COMMENT ) {
      str_state = STATE_STR1;
      out.push(c);
    } else if ( c === EOF || c === CHR_CLOSE && out[out.length - 1] === CHR_PCT ) {

      if (c !== EOF && com_state !== STATE_LINECOM) out.pop();
      if (state === STATE_JS_PRINT) {
        out.push(');');
      }
      state = STATE_HTML;
      str_state = STATE_NO_STR;
      com_state = STATE_NO_COMMENT;
    } else if (com_state === STATE_LINECOM) {
      if (
        c === CHR_CR
        || c === CHR_PCT && arr[i + 1] === CHR_CLOSE
      ) {
        com_state = STATE_NO_COMMENT;
        out.push(c);
      }
    } else {
      out.push(c);
    }
  } // end for
  out.push(FINISH);
  process.stdio.writeError("PARSED: "+out.join("")+"\n");
  return out.join("");
};