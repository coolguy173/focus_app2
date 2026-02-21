from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import os
import random

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'focusbattle-secret-2026')

DATABASE = 'focusbattle.db'

HARVEY_QUOTES = [
    "I don't have dreams, I have goals.",
    "Work until you no longer have to introduce yourself.",
    "Anyone can do my job, but no one can be me.",
    "Win your morning. Win your day.",
    "I refuse to answer that on the grounds that I don't want to.",
    "When you're backed against the wall, break the goddamn thing down.",
    "The only time success comes before work is in the dictionary.",
    "Don't raise your voice. Improve your argument.",
    "Kill them with success and bury them with a smile.",
    "You don't get have to be the best. You just have to be better than the person across from you.",
    "Let them underestimate you. That's when you strike.",
    "Competence is the baseline. Confidence is the weapon.",
    "Winners don't make excuses when the other side plays the game.",
    "First impressions last. Make yours count.",
    "I'm not the one who has to live with your choices. You are.",
    "Stop being perfect. Be better.",
    "Never destroy anyone in public when you can accomplish the same result in private.",
    "You always have a choice.",
    "Loyalty is a two-way street. If I'm asking it of you, you're getting it from me.",
    "The best way to get what you want is to deserve what you want.",
]

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT    UNIQUE NOT NULL,
            password_hash TEXT    NOT NULL,
            wins          INTEGER DEFAULT 0,
            losses        INTEGER DEFAULT 0,
            streak        INTEGER DEFAULT 0,
            best_streak   INTEGER DEFAULT 0,
            theme         TEXT    DEFAULT 'theme-lofi'
        );
    """)
    conn.commit()
    conn.close()

with app.app_context():
    init_db()

def current_user():
    user_id = session.get('user_id')
    if not user_id:
        return None
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.close()
    return user

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('user_id'):
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

# ── Auth ──────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    if session.get('user_id'):
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        conn = get_db()
        user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        conn.close()
        if not user or not check_password_hash(user['password_hash'], password):
            error = 'Invalid username or password.'
        else:
            session['user_id'] = user['id']
            return redirect(url_for('dashboard'))
    return render_template('login.html', error=error)

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        if not username or not password:
            error = 'Both fields required.'
        elif len(username) < 3:
            error = 'Username must be at least 3 characters.'
        elif len(password) < 6:
            error = 'Password must be at least 6 characters.'
        else:
            conn = get_db()
            existing = conn.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
            if existing:
                error = 'Username already taken.'
            else:
                hashed = generate_password_hash(password)
                conn.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', (username, hashed))
                conn.commit()
                user = conn.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
                session['user_id'] = user['id']
                conn.close()
                return redirect(url_for('dashboard'))
            conn.close()
    return render_template('signup.html', error=error)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# ── Pages ─────────────────────────────────────────────────────────────────────

@app.route('/dashboard')
@login_required
def dashboard():
    user = current_user()
    return render_template('dashboard.html', user=user)

@app.route('/timer')
@login_required
def timer():
    user = current_user()
    duration = request.args.get('duration', '25')
    quote = random.choice(HARVEY_QUOTES)
    return render_template('timer.html', user=user, duration=duration, quote=quote)

@app.route('/leaderboard')
@login_required
def leaderboard():
    conn = get_db()
    top_users = conn.execute(
        'SELECT username, wins, losses, streak, best_streak FROM users ORDER BY wins DESC LIMIT 20'
    ).fetchall()
    conn.close()
    return render_template('leaderboard.html', users=top_users, current_user=current_user())

@app.route('/settings')
@login_required
def settings():
    user = current_user()
    return render_template('settings.html', user=user)

# ── API ───────────────────────────────────────────────────────────────────────

@app.route('/api/session/win', methods=['POST'])
@login_required
def session_win():
    user_id = session['user_id']
    conn = get_db()
    conn.execute('UPDATE users SET wins = wins + 1, streak = streak + 1 WHERE id = ?', (user_id,))
    # Update best streak if current streak exceeds it
    conn.execute('UPDATE users SET best_streak = streak WHERE id = ? AND streak > best_streak', (user_id,))
    conn.commit()
    user = conn.execute('SELECT wins, losses, streak, best_streak FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.close()
    return jsonify({'status': 'win', 'wins': user['wins'], 'losses': user['losses'], 'streak': user['streak'], 'best_streak': user['best_streak']})

@app.route('/api/session/loss', methods=['POST'])
@login_required
def session_loss():
    user_id = session['user_id']
    conn = get_db()
    conn.execute('UPDATE users SET losses = losses + 1, streak = 0 WHERE id = ?', (user_id,))
    conn.commit()
    user = conn.execute('SELECT wins, losses, streak FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.close()
    return jsonify({'status': 'loss', 'wins': user['wins'], 'losses': user['losses'], 'streak': user['streak']})

@app.route('/api/theme', methods=['POST'])
@login_required
def save_theme():
    theme = request.json.get('theme', 'theme-lofi')
    user_id = session['user_id']
    conn = get_db()
    conn.execute('UPDATE users SET theme = ? WHERE id = ?', (theme, user_id))
    conn.commit()
    conn.close()
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
