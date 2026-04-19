#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mongodump --out ./backups/$TIMESTAMP
