"""Seed data — loads real problem data from JSON files and builds matching domain hierarchy.

The chapter IDs in the domain hierarchy must match the chapter field
in each problem so the frontend can filter problems by subject.

Data files (relative to backend/):
  ../data/problems.json           — 135 Go problems, 13 chapters (ch1–ch13)
  ../data/problems_robotics.json  — 3 Robotics problems, 3 chapters (ch2, ch4, ch9)
"""

import json
from pathlib import Path

from app.config import get_settings
from app.domain.workspace import (
    Chapter,
    Domain,
    Resource,
    Subject,
    Topic,
)
from app.storage import workspace_repo
from app.storage.database import init_db


def _load_problems_json(rel_path: str) -> dict:
    """Load a problems JSON file, searching relative to this file's dir and CWD."""
    candidates = [
        Path(__file__).resolve().parent.parent / rel_path,
        Path.cwd() / rel_path,
    ]
    for path in candidates:
        if path.exists():
            with open(path) as f:
                return json.load(f)
    raise FileNotFoundError(
        f"Cannot find {rel_path} — tried: {[str(p) for p in candidates]}"
    )


def build_seed_domains() -> list[Domain]:
    go_data = _load_problems_json("../data/problems.json")
    robot_data = _load_problems_json("../data/problems_robotics.json")

    go_chapters_raw = go_data.get("chapters", [])
    robot_chapters_raw = robot_data.get("chapters", [])

    go_chapters = [
        Chapter(
            id=ch["id"],
            name=ch["title"],
            description=ch.get("description", ""),
            topics=[Topic(id=f"{ch['id']}-intro", name="Getting Started")],
        )
        for ch in go_chapters_raw
    ]

    robot_chapters = [
        Chapter(
            id=ch["id"],
            name=ch["title"],
            description=ch.get("description", ""),
            topics=[Topic(id=f"{ch['id']}-intro", name="Getting Started")],
        )
        for ch in robot_chapters_raw
    ]

    robot_chapters.append(
        Chapter(
            id="c2",
            name="Chapter 2: Configuration Space",
            description="Degrees of freedom, Grubler's formula, configuration space topology, task space vs C-space.",
            instructions="Check planar vs spatial degrees of freedom factors and C-space dimensional topology.",
            memory="Focus on screw coordinate systems and spatial tree joints.",
            topics=[
                Topic(id="deg-freedom", name="Degrees of Freedom", last_message="Completed 1 hour ago", pinned=True),
                Topic(id="grubler-formula", name="Grubler's Formula", last_message="Needs practice"),
                Topic(id="cspace-topology", name="Configuration Space Topology", last_message="Solved 2 days ago"),
            ],
        ),
    )

    return [
        Domain(
            id="robotics",
            name="Robotics",
            pinned=True,
            subjects=[
                Subject(
                    id="modern-robotics",
                    name="Modern Robotics",
                    description="Master kinematics, rigid body motions, dynamics, and planning of robotic manipulators.",
                    instructions="Emphasize screw theory, exponential coordinate representations, and homogeneous transformations.",
                    memory="CS AI/Data Science student learning robotics — screw theory, kinematics, and trajectory planning.",
                    pinned=True,
                    chapters=robot_chapters,
                    resources=[
                        Resource(id="res-pdf", name="Modern_Robotics_Kinematics.pdf", lines=14500, file_type="PDF"),
                        Resource(id="res-deriv", name="Screw_Theory_Derivations.md", lines=320, file_type="MD"),
                        Resource(id="res-lib", name="robotics_math.js", lines=750, file_type="JS"),
                    ],
                ),
                Subject(
                    id="cmu-mrsd",
                    name="CMU MRSD Prep",
                    description="Preparation exercises for CMU Master of Robotic Systems Development curriculum.",
                    instructions="Focus on state-space representations, PID control loop feedback stability, and integral windup.",
                    memory="CS AI/Data Science student preparing for CMU MRSD controls courses.",
                    chapters=[
                        Chapter(
                            id="ctrl-th",
                            name="Control Theory",
                            description="Feedback loop structures, proportional integral derivative variables, transfer functions.",
                            instructions="Emphasize standard PID integral windup pitfalls.",
                            memory="PID feedforward and feedback loop gains.",
                            topics=[
                                Topic(id="pid-tuning", name="PID Feedback Control Loop", last_message="Draft ready"),
                            ],
                        ),
                    ],
                    resources=[
                        Resource(id="res-ctrl", name="PID_Controller_Design.pdf", lines=4500, file_type="PDF"),
                    ],
                ),
            ],
        ),
        Domain(
            id="perception",
            name="Perception",
            subjects=[
                Subject(
                    id="computer-vision",
                    name="Computer Vision",
                    description="Mathematical operations for digital image filters, edge extraction, and descriptors.",
                    instructions="Focus on pixel convolution kernels, Sobel derivatives, and SIFT descriptor mappings.",
                    memory="Perception and sensor fusion concepts for self driving perception pipelines.",
                    chapters=[
                        Chapter(
                            id="filters",
                            name="Image Filters & Operators",
                            description="Gaussian blurs, kernel convolutions, Sobel derivatives, and gradient magnitude.",
                            instructions="Derive edge gradient magnitude equations manually.",
                            memory="Pixel convolutions and Gaussian kernel convolutions.",
                            topics=[
                                Topic(id="gaussian-blur", name="Gaussian Filter Derivation", last_message="Not started"),
                                Topic(id="sobel-edge", name="Sobel Edge Kernel Convolution", last_message="Not started"),
                            ],
                        ),
                    ],
                    resources=[
                        Resource(id="res-cv", name="Computer_Vision_Algorithms.md", lines=1100, file_type="MD"),
                    ],
                ),
            ],
        ),
        Domain(
            id="go-programming",
            name="Go Programming",
            pinned=True,
            subjects=[
                Subject(
                    id="go-fundamentals",
                    name="Go Fundamentals",
                    description="Learn the fundamentals of Go, including basic types, variables, control flow, functions, slices, maps, and concurrency.",
                    instructions="Focus on pointers, array slice internals, maps, goroutines, and channels.",
                    memory="CS AI/Data Science student learning systems programming and concurrency in Go.",
                    pinned=True,
                    chapters=go_chapters,
                    resources=[
                        Resource(id="go-quickstart", name="Go_Basics_Quickstart.md", lines=180, file_type="MD"),
                        Resource(id="go-spec", name="Go_Language_Specification.pdf", lines=8400, file_type="PDF"),
                    ],
                ),
            ],
        ),
    ]


def seed() -> None:
    """Initialise the database and seed workspace data."""
    settings = get_settings()
    init_db(settings)
    domains = build_seed_domains()
    workspace_repo.set_domains(domains)
    print(f"Seeded {len(domains)} domains into workspace repository.")
    print(f"  Go Programming: 13 chapters (ch1-ch13)")
    print(f"  Robotics: {len([d for d in domains if d.id=='robotics'][0].subjects[0].chapters)} chapters")
    print(f"SQLite event tables created at: {settings.db_path}")


if __name__ == "__main__":
    seed()
