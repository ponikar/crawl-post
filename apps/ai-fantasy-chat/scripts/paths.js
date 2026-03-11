const path = require("path");

const APP_ROOT = path.join(__dirname, "..");
const REPO_ROOT = path.join(APP_ROOT, "..", "..");

const APP_MEMORY_DIR = path.join(APP_ROOT, "memory");
const APP_POSTS_DIR = path.join(APP_ROOT, "posts");
const SHARED_ROOT = path.join(REPO_ROOT, "shared");
const SHARED_MEMORY_DIR = path.join(SHARED_ROOT, "memory");
const SHARED_SKILLS_DIR = path.join(SHARED_ROOT, "skills");
const NODE_MODULES_DIR = path.join(REPO_ROOT, "node_modules");
const CONFIG_PATH = path.join(APP_ROOT, "config.json");

module.exports = {
  APP_ROOT,
  REPO_ROOT,
  APP_MEMORY_DIR,
  APP_POSTS_DIR,
  SHARED_ROOT,
  SHARED_MEMORY_DIR,
  SHARED_SKILLS_DIR,
  NODE_MODULES_DIR,
  CONFIG_PATH,
};
