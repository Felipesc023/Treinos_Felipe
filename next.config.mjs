import path from 'node:path';

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // há outro package-lock.json em ../ (Downloads): sem isto o Next trata aquela pasta como a raiz e varre arquivos à toa
  outputFileTracingRoot: path.resolve('.'),
};
