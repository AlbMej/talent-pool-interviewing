from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import json
import os
import glob
import re

app = Flask(__name__)
CORS(app)

# Path to job skill trees directory
JOB_SKILL_TREES_DIR = os.path.join(os.path.dirname(__file__), 'data', 'job_skill_trees')

# Default skill tree data
DEFAULT_SKILL_TREE = {
    "name": "Skills",
    "children": [
        {
            "name": "Technical Skills",
            "children": [
                {
                    "name": "Programming Languages",
                    "children": [
                        {"name": "Python", "type": "skill"},
                        {"name": "Rust", "type": "skill"}
                    ]
                },
                {
                    "name": "Frameworks",
                    "children": [
                        {"name": "Jax", "type": "skill"}
                    ]
                },
                {
                    "name": "Technologies",
                    "children": [
                        {"name": "large-scale distributed machine learning systems", "type": "skill"}
                    ]
                }
            ]
        },
        {
            "name": "ML/AI Concepts",
            "children": [
                {"name": "fine-tuning large language models", "type": "skill"},
                {"name": "reinforcement learning", "type": "skill"},
                {"name": "reward models", "type": "skill"},
                {"name": "model evaluation", "type": "skill"},
                {"name": "inference-time search techniques", "type": "skill"},
                {"name": "model optimizations", "type": "skill"}
            ]
        },
        {
            "name": "Methodologies & Techniques",
            "children": [
                {"name": "data collection pipelines", "type": "skill"},
                {"name": "data generation techniques", "type": "skill"},
                {"name": "reinforcement learning algorithms", "type": "skill"},
                {"name": "model training frameworks", "type": "skill"}
            ]
        },
        {
            "name": "Domain Expertise",
            "children": [
                {"name": "post-training", "type": "skill"},
                {"name": "pre-training", "type": "skill"},
                {"name": "reasoning", "type": "skill"},
                {"name": "multimodal", "type": "skill"}
            ]
        }
    ],
    "job_id": 4374125007,
    "job_title": "Member of Technical Staff, Post-training",
    "location": "Palo Alto, CA; San Francisco, CA"
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/v1/jobs', methods=['GET'])
def list_jobs():
    """List all available jobs"""
    jobs = []
    json_files = glob.glob(os.path.join(JOB_SKILL_TREES_DIR, 'job_*.json'))
    
    for json_file in json_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                job_id = data.get('job_id')
                job_title = data.get('job_title', 'Unknown')
                location = data.get('location', '')
                
                if job_id:
                    jobs.append({
                        'job_id': job_id,
                        'job_title': job_title,
                        'location': location
                    })
        except Exception as e:
            print(f"Error reading {json_file}: {e}")
            continue
    
    # Sort by job title
    jobs.sort(key=lambda x: x['job_title'])
    return jsonify({'jobs': jobs})

@app.route('/api/v1/skill-trees/<job_id>', methods=['GET'])
def get_skill_tree(job_id):
    """Get skill tree by job ID"""
    # Try to find the job file
    json_files = glob.glob(os.path.join(JOB_SKILL_TREES_DIR, f'job_{job_id}_*.json'))
    
    if json_files:
        try:
            with open(json_files[0], 'r', encoding='utf-8') as f:
                return jsonify(json.load(f))
        except Exception as e:
            print(f"Error reading skill tree for job {job_id}: {e}")
    
    # Fallback to default
    return jsonify(DEFAULT_SKILL_TREE)

@app.route('/api/v1/skill-trees/default', methods=['GET'])
def get_default_skill_tree():
    """Get default skill tree"""
    return jsonify(DEFAULT_SKILL_TREE)

@app.route('/api/v1/generate-interview-questions', methods=['POST'])
def generate_questions():
    """Generate interview questions based on skill tree"""
    data = request.json
    job_title = data.get('job_title', 'Software Engineer')
    skills = data.get('skills', '')
    
    # Simple question generation (in production, use AI service)
    questions = [
        f"Can you explain your experience with {job_title}?",
        "What technical challenges have you faced in your previous projects?",
        "How do you approach problem-solving in a technical context?",
        "Can you describe a complex project you've worked on?",
        "What methodologies do you use for software development?"
    ]
    
    # If skills provided, add skill-specific questions
    if skills:
        skill_list = skills.split(',')[:3]
        for skill in skill_list:
            questions.append(f"Can you tell me about your experience with {skill.strip()}?")
    
    return jsonify({"questions": questions[:8]})

if __name__ == '__main__':
    app.run(debug=True, port=5000)

