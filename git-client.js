// Git 操作模块
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class GitClient {
  /**
   * 执行 Git 命令
   */
  execCommand(command, cwd) {
    return new Promise((resolve, reject) => {
      exec(command, { cwd, encoding: 'utf-8' }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve(stdout.trim());
      });
    });
  }

  /**
   * 获取当前分支
   */
  async getCurrentBranch(repoPath) {
    try {
      const branch = await this.execCommand('git branch --show-current', repoPath);
      return branch;
    } catch (e) {
      console.log(`⚠️ 获取分支失败：${e.message}`);
      return 'unknown';
    }
  }

  /**
   * 获取所有分支
   */
  async getAllBranches(repoPath) {
    try {
      const output = await this.execCommand('git branch -a', repoPath);
      const branches = output.split('\n').map(b => {
        return b.replace('*', '').replace('remotes/', '').trim();
      }).filter(b => b && !b.includes('HEAD'));
      
      // 去重
      return [...new Set(branches)];
    } catch (e) {
      console.log(`⚠️ 获取分支列表失败：${e.message}`);
      return [];
    }
  }

  /**
   * 切换分支
   */
  async checkoutBranch(repoPath, branch) {
    try {
      await this.execCommand(`git checkout ${branch}`, repoPath);
      return { success: true, message: `已切换到分支 ${branch}` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * 拉取最新代码
   */
  async pull(repoPath) {
    try {
      const output = await this.execCommand('git pull', repoPath);
      return { success: true, message: output };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * 获取最新提交记录
   */
  async getRecentCommits(repoPath, count = 2) {
    try {
      const format = '%H|%ai|%s';
      const output = await this.execCommand(
        `git log -${count} --pretty=format:"${format}"`,
        repoPath
      );
      
      const commits = output.split('\n').map(line => {
        const [hash, time, message] = line.split('|');
        return {
          hash: hash.substring(0, 7),
          fullHash: hash,
          time: time.replace(' +', ' GMT+'),
          message: message
        };
      });
      
      return commits;
    } catch (e) {
      console.log(`⚠️ 获取提交记录失败：${e.message}`);
      return [];
    }
  }

  /**
   * 获取项目状态
   */
  async getRepoStatus(repoPath) {
    try {
      const [branch, commits] = await Promise.all([
        this.getCurrentBranch(repoPath),
        this.getRecentCommits(repoPath, 2)
      ]);
      
      return {
        branch,
        commits,
        path: repoPath
      };
    } catch (e) {
      return {
        branch: 'unknown',
        commits: [],
        path: repoPath,
        error: e.message
      };
    }
  }
}

module.exports = new GitClient();
