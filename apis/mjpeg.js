const http = require('http');

const partly = (buf, token) => {
  const index = buf.indexOf(token);
  if (index === -1) return [ buf, "" ];
  return [ buf.slice(0, index), buf.slice(index+token.length) ]
};

const parse_part = (buf) => {
  const [ _, other1 ] = partly(buf, Buffer.from('\r\n'));
  const [ type_h, other2 ] = partly(other1, Buffer.from('\r\n'));
  const [ size_h, content_start ] = partly(other2, Buffer.from('\r\n'));
  const [ _1, content ] = partly(content_start, Buffer.from('\r\n'));

  const type = type_h.toString().split(":")[1].trim();
  const size = Number(size_h.toString().split(":")[1].trim());

  return [ type, size, content ];
};

const boundary = "boundary=";

const mjpeg = {
  parse_body: (url, count = 1) => {
    return new Promise((resolve, reject) => {
      let parts = [];
      try {
        http.get(url, function(res) {
          const content_type = res.headers['content-type'];
          const b = "--" + content_type.substring(content_type.indexOf(boundary)+boundary.length);
          const b_buf = Buffer.from(b);

          let body = Buffer.alloc(0);

          res.on('data', function(chunk) {
            body = Buffer.concat([body, chunk]);

            const b_index = body.indexOf(b_buf);
            if (b_index !== -1) {
              const prev_part = body.slice(0, b_index);
              const next_part = body.slice(b_index+b.length);
              if (prev_part.length !== 0) parts.push(prev_part);
              body = next_part;
            }

            if (parts.length >= count) {
              res.destroy();
              const arr = parts.map(el => parse_part(el));
              resolve(arr);
            }
          });
        });
      } catch(e) {
        reject(e);
      }
    });
  },
};

module.exports = mjpeg;