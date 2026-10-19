const assert = require('node:assert/strict');
const http = require('node:http');
const { Readable } = require('node:stream');
const test = require('node:test');

const cloudinaryPath = require.resolve('../src/utils/cloudinary');

test('production image uploads use memory storage without relying on Vercel env flags', async () => {
  const originalEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };

  process.env.NODE_ENV = 'production';
  delete process.env.VERCEL;
  delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  process.env.CLOUDINARY_CLOUD_NAME = '';
  process.env.CLOUDINARY_API_KEY = '';
  process.env.CLOUDINARY_API_SECRET = '';
  delete require.cache[cloudinaryPath];

  try {
    const { upload, uploadImage } = require(cloudinaryPath);
    const content = Buffer.from('image bytes');
    const storedFile = await new Promise((resolve, reject) => {
      upload.storage._handleFile(
        {},
        { stream: Readable.from(content) },
        (error, file) => error ? reject(error) : resolve(file),
      );
    });

    assert.deepEqual(storedFile.buffer, content);
    assert.equal(storedFile.size, content.length);
    assert.equal(storedFile.path, undefined);

    const server = http.createServer((request, response) => {
      response.status = function (statusCode) {
        this.statusCode = statusCode;
        return this;
      };
      response.json = function (body) {
        this.setHeader('Content-Type', 'application/json');
        this.end(JSON.stringify(body));
      };
      uploadImage(request, response, () => {
        response.statusCode = 204;
        response.end();
      });
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    try {
      const address = server.address();
      const form = new FormData();
      form.append('image', new Blob([content], { type: 'image/png' }), 'avatar.png');
      const response = await fetch(`http://127.0.0.1:${address.port}`, {
        method: 'POST',
        body: form,
      });

      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        message: 'Image uploads are not configured on this server.',
      });
    } finally {
      server.closeAllConnections();
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  } finally {
    delete require.cache[cloudinaryPath];
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
