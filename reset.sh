#!/bin/bash
rm -rf dist
rm -rf node_modules
rm -rf tmp
git checkout -- package.json
rm yarn.lock
