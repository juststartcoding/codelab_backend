const express = require("express");
const db = require("../db");
const { getDefaultContent } = require("../helpers");
const { auth, requireRole } = require("../middleware/auth");

const router = express.Router();

// Make a simple file id
const mongoose = require("mongoose");
const makeId = () => new mongoose.Types.ObjectId();

// Populate studentId field manually (NeDB has no populate)
async function populateStudent(project) {
  if (!project) return null;
  const student = project.studentId
    ? await db.users.findOne({ _id: project.studentId })
    : null;
  return {
    ...project,
    studentId: student
      ? { _id: student._id, name: student.name, email: student.email }
      : null,
  };
}

// Student: get own projects
router.get("/my", auth, requireRole("student"), async (req, res) => {
  try {
    const projects = await db.projects.find({ studentId: req.user._id }).lean();
    projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Tutor/Admin: get ALL projects
router.get("/", auth, requireRole("tutor", "admin"), async (req, res) => {
  try {
    const projects = await db.projects.find({}).lean();
    const populated = await Promise.all(projects.map(populateStudent));
    populated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single project
router.get("/:id", auth, async (req, res) => {
  try {
    const project = await db.projects.findOne({ _id: req.params.id });
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (
      req.user.role === "student" &&
      project.studentId?.toString() !== req.user._id?.toString()
    )
      return res.status(403).json({ message: "Access denied" });
    res.json(await populateStudent(project));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create project
router.post("/", auth, requireRole("student"), async (req, res) => {
  try {
    const { name, description, language } = req.body;
    if (!name)
      return res.status(400).json({ message: "Project name required" });
    const lang = language || "c";
    const ext =
      lang === "cpp"
        ? "cpp"
        : lang === "python"
          ? "py"
          : lang === "java"
            ? "java"
            : lang === "javascript"
              ? "js"
              : "c";
    const project = await db.projects.insert({
      name,
      description: description || "",
      studentId: req.user._id,
      language: lang,
      files: [
        {
          _id: makeId(),
          name: `main.${ext}`,
          language: lang,
          content: getDefaultContent(lang),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      comments: [],
      isSubmitted: false,
      grade: "",
      tutorFeedback: "",
      lastEditedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add file to project
router.post("/:id/files", auth, async (req, res) => {
  try {
    const project = await db.projects.findOne({ _id: req.params.id });
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (
      req.user.role === "student" &&
      project.studentId?.toString() !== req.user._id?.toString()
    )
      return res.status(403).json({ message: "Access denied" });
    const { name, language } = req.body;
    const newFile = {
      _id: makeId(),
      name,
      language: language || "c",
      content: getDefaultContent(language || "c"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const files = [...project.files, newFile];
    await db.projects.update(
      { _id: req.params.id },
      { $set: { files, updatedAt: new Date() } },
    );
    const updated = await db.projects.findOne({ _id: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update file content
router.patch("/:id/files/:fileId", auth, async (req, res) => {
  try {
    const project = await db.projects.findOne({ _id: req.params.id });
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (
      req.user.role === "student" &&
      project.studentId?.toString() !== req.user._id?.toString()
    )
      return res.status(403).json({ message: "Access denied" });
    const files = project.files.map((f) =>
      f._id?.toString() === req.params.fileId
        ? {
            ...f,
            ...(req.body.content !== undefined && {
              content: req.body.content,
            }),
            ...(req.body.name && { name: req.body.name }),
            updatedAt: new Date(),
          }
        : f,
    );
    await db.projects.update(
      { _id: req.params.id },
      { $set: { files, lastEditedBy: req.user._id, updatedAt: new Date() } },
    );
    const updated = await db.projects.findOne({ _id: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete file
router.delete(
  "/:id/files/:fileId",
  auth,
  requireRole("student"),
  async (req, res) => {
    try {
      const project = await db.projects.findOne({ _id: req.params.id });
      if (!project)
        return res.status(404).json({ message: "Project not found" });
      if (project.studentId?.toString() !== req.user._id?.toString())
        return res.status(403).json({ message: "Access denied" });
      const files = project.files.filter((f) => f._id !== req.params.fileId);
      await db.projects.update(
        { _id: req.params.id },
        { $set: { files, updatedAt: new Date() } },
      );
      const updated = await db.projects.findOne({ _id: req.params.id });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

// Tutor: add comment
router.post(
  "/:id/comments",
  auth,
  requireRole("tutor", "admin"),
  async (req, res) => {
    try {
      const project = await db.projects.findOne({ _id: req.params.id });
      if (!project)
        return res.status(404).json({ message: "Project not found" });
      const comment = {
        _id: makeId(),
        tutorId: req.user._id,
        tutorName: req.user.name,
        ...req.body,
        createdAt: new Date(),
      };
      const comments = [...project.comments, comment];
      await db.projects.update(
        { _id: req.params.id },
        { $set: { comments, updatedAt: new Date() } },
      );
      const updated = await db.projects.findOne({ _id: req.params.id });
      res.json(await populateStudent(updated));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

// Tutor: grade/feedback
router.patch(
  "/:id/feedback",
  auth,
  requireRole("tutor", "admin"),
  async (req, res) => {
    try {
      await db.projects.update(
        { _id: req.params.id },
        {
          $set: {
            grade: req.body.grade || "",
            tutorFeedback: req.body.feedback || "",
            updatedAt: new Date(),
          },
        },
      );
      const updated = await db.projects.findOne({ _id: req.params.id });
      res.json(await populateStudent(updated));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

// Student: delete project
router.delete("/:id", auth, requireRole("student"), async (req, res) => {
  try {
    const project = await db.projects.findOne({ _id: req.params.id });
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.studentId?.toString() !== req.user._id?.toString())
      return res.status(403).json({ message: "Access denied" });
    await db.projects.remove({ _id: req.params.id }, {});
    res.json({ message: "Project deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

// ── /run — Execute code with interactive stdin ───────────────────────────────
const { execSync, spawn } = require("child_process");
const fs_run = require("fs");
const os_run = require("os");
const path_run = require("path");

function buildRunConfig(language, code, tmpDir) {
  let filename, compileCmd, runArgs;
  switch (language) {
    case "c":
      filename = path_run.join(tmpDir, "main.c");
      fs_run.writeFileSync(filename, code);
      compileCmd = [
        "gcc",
        [filename, "-o", path_run.join(tmpDir, "main"), "-lm"],
      ];
      runArgs = [path_run.join(tmpDir, "main"), []];
      break;
    case "cpp":
      filename = path_run.join(tmpDir, "main.cpp");
      fs_run.writeFileSync(filename, code);
      compileCmd = [
        "g++",
        [filename, "-o", path_run.join(tmpDir, "main"), "-std=c++17"],
      ];
      runArgs = [path_run.join(tmpDir, "main"), []];
      break;
    case "python":
      filename = path_run.join(tmpDir, "main.py");
      fs_run.writeFileSync(filename, code);
      runArgs = ["python3", ["-u", filename]]; // -u = unbuffered
      break;
    case "java":
      filename = path_run.join(tmpDir, "Main.java");
      fs_run.writeFileSync(filename, code);
      compileCmd = ["javac", [filename, "-d", tmpDir]];
      runArgs = ["java", ["-cp", tmpDir, "Main"]];
      break;
    case "javascript":
      filename = path_run.join(tmpDir, "main.js");
      fs_run.writeFileSync(filename, code);
      runArgs = ["node", [filename]];
      break;
    default:
      return null;
  }
  return { compileCmd, runArgs };
}

// POST /run — stdin passed as string (all inputs at once)
router.post("/run", auth, async (req, res) => {
  const { code, language, stdin = "" } = req.body;
  if (!code)
    return res.status(400).json({ output: "No code provided", error: true });

  const tmpDir = fs_run.mkdtempSync(path_run.join(os_run.tmpdir(), "codelab-"));
  const timeout = 10000;

  try {
    const cfg = buildRunConfig(language, code, tmpDir);
    if (!cfg) return res.json({ output: "Unsupported language", error: true });

    // Compile
    if (cfg.compileCmd) {
      try {
        execSync(`${cfg.compileCmd[0]} ${cfg.compileCmd[1].join(" ")}`, {
          timeout,
          stdio: "pipe",
        });
      } catch (e) {
        return res.json({
          output: e.stdout?.toString() || e.message,
          error: true,
          status: "Compilation Error",
        });
      }
    }

    // Run — pass all stdin at once (works for scanf, input(), Scanner etc.)
    return new Promise((resolve) => {
      const proc = spawn(cfg.runArgs[0], cfg.runArgs[1], {
        stdio: ["pipe", "pipe", "pipe"],
      });
      let output = "";
      let errOut = "";
      const timer = setTimeout(() => {
        proc.kill("SIGKILL");
      }, timeout);

      proc.stdout.on("data", (d) => {
        output += d.toString();
      });
      proc.stderr.on("data", (d) => {
        errOut += d.toString();
      });

      proc.on("close", (code) => {
        clearTimeout(timer);
        try {
          fs_run.rmSync(tmpDir, { recursive: true, force: true });
        } catch {}
        const hasError = code !== 0;
        const finalOut =
          (output + errOut).trim() ||
          (hasError ? "Runtime error" : "(no output)");
        res.json({
          output: finalOut,
          error: hasError,
          status: hasError ? "Runtime Error" : "Accepted",
        });
        resolve();
      });

      proc.on("error", (e) => {
        clearTimeout(timer);
        res.json({ output: e.message, error: true, status: "Error" });
        resolve();
      });

      // Write all stdin then close
      if (stdin) {
        proc.stdin.write(stdin.endsWith("\n") ? stdin : stdin + "\n");
      }
      proc.stdin.end();
    });
  } catch (err) {
    try {
      fs_run.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
    res.json({ output: err.message, error: true, status: "Error" });
  }
});

// GET /run/stream — SSE real-time interactive terminal
router.get("/run/stream", auth, (req, res) => {
  const { code, language, sessionId } = req.query;
  if (!code) {
    res.status(400).end();
    return;
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (type, data) =>
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);

  const tmpDir = fs_run.mkdtempSync(
    path_run.join(os_run.tmpdir(), "codelab-stream-"),
  );
  const cfg = buildRunConfig(language, decodeURIComponent(code), tmpDir);

  if (!cfg) {
    send("error", "Unsupported language");
    res.end();
    return;
  }

  const cleanup = () => {
    try {
      fs_run.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  };

  const doRun = () => {
    const proc = spawn(cfg.runArgs[0], cfg.runArgs[1], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Store proc ref on res so client can send stdin
    res._proc = proc;

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      send("error", "Timeout (10s)");
    }, 10000);

    proc.stdout.on("data", (d) => send("output", d.toString()));
    proc.stderr.on("data", (d) => send("output", d.toString()));
    proc.on("close", (code) => {
      clearTimeout(timer);
      send("done", code === 0 ? "Accepted" : "Runtime Error");
      cleanup();
      res.end();
    });
    proc.on("error", (e) => {
      send("error", e.message);
      cleanup();
      res.end();
    });
  };

  // Compile first if needed
  if (cfg.compileCmd) {
    send("output", "Compiling...\n");
    try {
      execSync(`${cfg.compileCmd[0]} ${cfg.compileCmd[1].join(" ")}`, {
        timeout: 8000,
        stdio: "pipe",
      });
      send("output", "Compiled successfully.\n\n");
      doRun();
    } catch (e) {
      send("output", e.stdout?.toString() || e.message);
      send("done", "Compilation Error");
      cleanup();
      res.end();
    }
  } else {
    doRun();
  }

  req.on("close", () => {
    if (res._proc) res._proc.kill("SIGKILL");
    cleanup();
  });
});

// POST /run/stdin — send input to running stream process (via socket instead)
// This is handled via socket.io for real-time bidirectional communication
