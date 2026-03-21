import { bootstrap, bootstrapWorker, runMigrations } from '@vendure/core';
import { config } from './vendure-config';
import { fork } from 'child_process';
import path from 'path';

runMigrations(config)
    .then(() => bootstrap(config))
    .then(() => {
        // Start worker in a child process to avoid CustomFields duplication
        const workerPath = path.join(__dirname, 'index-worker.js');
        const child = fork(workerPath);
        child.on('exit', (code) => {
            console.log(`Worker exited with code ${code}, restarting...`);
            setTimeout(() => fork(workerPath), 1000);
        });
        console.log('Worker process started');
    })
    .catch(err => {
        console.log(err);
    });
