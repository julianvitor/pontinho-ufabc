import json
import sys
from pathlib import Path

# Garante resolução de imports dentro do backend
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    from database import get_db, init_db, hash_password
except ImportError:
    from backend.database import get_db, init_db, hash_password

def seed_database():
    init_db()
    conn = get_db()
    cursor = conn.cursor()

    # 1. Cursos Base
    base_courses = [
        "BC&T - Bacharelado em Ciência e Tecnologia",
        "BC&H - Bacharelado em Ciências e Humanidades",
        "LC&T - Licenciatura em Ciências e Tecnologia",
        "LCH - Licenciatura em Ciências Humanas"
    ]
    for c in base_courses:
        cursor.execute("INSERT OR IGNORE INTO courses (name, category) VALUES (?, 'base')", (c,))

    # Cursos Específicos (Pós-BI)
    specific_courses = [
        "Ciência da Computação",
        "Engenharia de Gestão",
        "Engenharia Aeroespacial",
        "Engenharia Biomédica",
        "Engenharia de Energia",
        "Engenharia de Informação",
        "Engenharia Ambiental e Urbana",
        "Engenharia de Materiais",
        "Neurociência",
        "Biotecnologia",
        "Relações Internacionais",
        "Ciências Econômicas",
        "Filosofia",
        "Matemática",
        "Física",
        "Química"
    ]
    for sc in specific_courses:
        cursor.execute("INSERT OR IGNORE INTO courses (name, category) VALUES (?, 'especifico')", (sc,))

    # 2. Entidades Estudantis UFABC
    entities = [
        ("Atlética Geral UFABC", "Associação Atlética Acadêmica da UFABC"),
        ("Bateria UFABC", "A bateria universitária mais ritmada do ABC"),
        ("Caiás", "Torcida organizada e espírito universitário"),
        ("Baja UFABC", "Equipe de competição automobilística off-road"),
        ("Centro Acadêmico BC&T", "Representação dos alunos de Ciência e Tecnologia"),
        ("Centro Acadêmico BC&H", "Representação dos alunos de Humanidades"),
        ("Enactus UFABC", "Projetos de empreendedorismo social"),
        ("GPDA", "Grupo de Pesquisa e Desenvolvimento Aeroespacial"),
        ("UFABC Rocket Design", "Engenharia de minifoguetes experimentais"),
        ("IEEE Student Branch", "Inovação tecnológica e conferências de engenharia"),
        ("Nenhuma / Foco no CR", "100% focado em sobreviver ao quadrimestre")
    ]
    for name, desc in entities:
        cursor.execute("INSERT OR IGNORE INTO entities (name, description) VALUES (?, ?)", (name, desc))

    # 3. Perguntinhas de Perfil
    prompts = [
        "O melhor lugar para descansar na UFABC é...",
        "Minha técnica infalível pra conseguir vaga no SIGAA...",
        "Minha opinião impopular sobre o RU...",
        "No intervalo entre as aulas você me encontra...",
        "A matéria que quase me fez trancar o curso foi...",
        "Um date ideal pelo ABC ou Santo André tem...",
        "Se você me pagar um salgado na lanchonete do Bloco A..."
    ]
    for p in prompts:
        cursor.execute("INSERT OR IGNORE INTO prompts (question) VALUES (?)", (p,))

    # 4. Publicidades (Ads intercalados no feed)
    ads = [
        (
            "🍻 Choppada da Federal 2026",
            "A maior integração universitária do ABC! Open bar, 3 palcos e atrações imperdíveis no Espaço Modular. Lote 2 esgotando!",
            "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80",
            "Garantir Ingresso",
            "https://ufabc.edu.br",
            1,
            3
        ),
        (
            "🖨️ Copiadora & Gráfica Bloco A",
            "Imprima suas listas de Funções de Uma Variável, slides e relatórios de laboratório com 20% de desconto para alunos matriculados.",
            "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80",
            "Pegar Cupom",
            "https://ufabc.edu.br",
            1,
            4
        ),
        (
            "🦊 Kit Bixo Oficial - Atlética",
            "Caneca de tirante de alumínio 850ml, abadá e bandana exclusiva. Seja sócio-torcedor com mensalidade promocional de R$ 15.",
            "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800&auto=format&fit=crop&q=80",
            "Pedir Kit",
            "https://ufabc.edu.br",
            1,
            4
        )
    ]
    for title, desc, img, btn, link, active, freq in ads:
        cursor.execute("""
            INSERT OR IGNORE INTO ads (title, description, image_url, button_text, link_url, is_active, frequency)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (title, desc, img, btn, link, active, freq))

    # 5. Usuários de Exemplo (com pelo menos 2 fotos cada, obrigatório por regra de negócio)
    mock_users = [
        {
            "ra": "admin",
            "password_hash": hash_password("admin123"),
            "email": "admin@ufabc.edu.br",
            "name": "Administrador UFABC",
            "age": 28,
            "campus": "Santo André",
            "course": "BC&T - Bacharelado em Ciência e Tecnologia",
            "specific_course": "Ciência da Computação",
            "entity": "Centro Acadêmico BC&T",
            "looking_for": "Amizade",
            "bio": "Conta de administração do Pontinho UFABC. Modero as entidades, cursos e publicidades.",
            "interests": json.dumps(["Tecnologia", "Gestão", "Café", "Open Source"]),
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "O melhor lugar para descansar na UFABC é...",
            "prompt1_a": "Os puffs do piso vermelho no Bloco A, se conseguir vaga antes do meio-dia.",
            "prompt2_q": "Minha opinião impopular sobre o RU...",
            "prompt2_a": "O suco de caju deles é injustiçado, eu acho ótimo.",
            "prompt3_q": "No intervalo entre as aulas você me encontra...",
            "prompt3_a": "Programando no laboratório ou caçando tomada no mezanino.",
            "gender": "Outro",
            "target_gender": "Todos",
            "songs": json.dumps(["Daft Punk - Harder Better Faster Stronger", "Kraftwerk - The Robots"]),
            "private_photos": json.dumps([]),
            "private_bio": "",
            "is_admin": 1
        },
        {
            "ra": "11202021001",
            "password_hash": hash_password("123456"),
            "email": "mariana.silva@aluno.ufabc.edu.br",
            "name": "Mariana Silva",
            "age": 21,
            "campus": "Santo André",
            "course": "BC&T - Bacharelado em Ciência e Tecnologia",
            "specific_course": "Neurociência",
            "entity": "Atlética Geral UFABC",
            "looking_for": "Algo sério",
            "bio": "Estudante do BC&T no 5º quadri. Amo o RU quando tem estrogonofe, viciada em café com leite do Bloco B e nos treinos de vôlei da Atlética.",
            "interests": json.dumps(["Vôlei", "Neurociência", "Café", "Praia", "Música Indie"]),
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "O melhor lugar para descansar na UFABC é...",
            "prompt1_a": "No gramado do Bloco A tomando sol nos dias sem prova de FUV.",
            "prompt2_q": "Minha técnica infalível pra conseguir vaga no SIGAA...",
            "prompt2_a": "Abrir 4 navegadores 1 minuto antes e rezar para todos os deuses do quadrimestre.",
            "prompt3_q": "Um date ideal pelo ABC ou Santo André tem...",
            "prompt3_a": "Pastel na feira de Santo André e depois um café pra papear sem pressa.",
            "gender": "Mulher",
            "target_gender": "Todos",
            "songs": json.dumps(["Chico Buarque - Construção", "Arctic Monkeys - 505", "Duda Beat - Bixinho"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1516726817505-f5ed825624d8?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Na facul pareço tímida, mas adoro uma festa até o amanhecer e um date com vinho e conversa sem tabu. Quer descobrir mais? 🔥",
            "is_admin": 0
        },
        {
            "ra": "11202021002",
            "password_hash": hash_password("123456"),
            "email": "lucas.mendes@aluno.ufabc.edu.br",
            "name": "Lucas Mendes",
            "age": 22,
            "campus": "São Bernardo do Campo",
            "course": "BC&H - Bacharelado em Ciências e Humanidades",
            "specific_course": "Relações Internacionais",
            "entity": "Caiás",
            "looking_for": "Algo casual",
            "bio": "RI em SBC. Me chama pra tomar uma cerveja depois das 21h ou debater geopolítica no pátio. Gosto de cinema cult e viajar de carona.",
            "interests": json.dumps(["Cinema", "Geopolítica", "Cervejada", "Livros", "Rock"]),
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "Minha opinião impopular sobre o RU...",
            "prompt1_a": "A fila de SBC anda bem mais rápido que a de Santo André, aceitem.",
            "prompt2_q": "A matéria que quase me fez trancar o curso foi...",
            "prompt2_a": "Introdução às Humanidades com fichamento semanal de 20 páginas.",
            "prompt3_q": "No intervalo entre as aulas você me encontra...",
            "prompt3_a": "Na banquinha discutindo o último filme da A24.",
            "gender": "Homem",
            "target_gender": "Mulheres",
            "songs": json.dumps(["Tame Impala - The Less I Know The Better", "Tim Maia - Não Quero Dinheiro", "The Strokes - Someday"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Gosto de olhares provocantes, carona noturna ouvindo indie e química que dispense apresentações formais. 😉",
            "is_admin": 0
        },
        {
            "ra": "11202021003",
            "password_hash": hash_password("123456"),
            "email": "beatriz.costa@aluno.ufabc.edu.br",
            "name": "Bia Costa",
            "age": 20,
            "campus": "Santo André",
            "course": "BC&T - Bacharelado em Ciência e Tecnologia",
            "specific_course": "Engenharia Aeroespacial",
            "entity": "UFABC Rocket Design",
            "looking_for": "Amizade",
            "bio": "Quero mandar foguetes pro espaço 🚀. Quando não estou no laboratório de propulsão, estou ouvindo Taylor Swift ou maratonando ficção científica.",
            "interests": json.dumps(["Astronomia", "Foguetes", "Taylor Swift", "Anime", "Jogos"]),
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "O melhor lugar para descansar na UFABC é...",
            "prompt1_a": "A biblioteca do Bloco B, no silêncio absoluto do último andar.",
            "prompt2_q": "Se você me pagar um salgado na lanchonete do Bloco A...",
            "prompt2_a": "Eu te explico como funciona a órbita de Hohmann sem complicar.",
            "prompt3_q": "Minha técnica infalível pra conseguir vaga no SIGAA...",
            "prompt3_a": "Fazer amizade com os veteranos pra saber quais professores não reprovam 80%.",
            "gender": "Mulher",
            "target_gender": "Todos",
            "songs": json.dumps(["Taylor Swift - Cruel Summer", "Daft Punk - Instant Crush", "Coldplay - Yellow"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Engenheira com lado secreto: fã de noites quentes, beijo roubado e dates despretensiosos que não têm hora pra acabar. 🚀✨",
            "is_admin": 0
        },
        {
            "ra": "11202021004",
            "password_hash": hash_password("123456"),
            "email": "gabriel.santos@aluno.ufabc.edu.br",
            "name": "Gabriel Santos",
            "age": 23,
            "campus": "Santo André",
            "course": "BC&T - Bacharelado em Ciência e Tecnologia",
            "specific_course": "Ciência da Computação",
            "entity": "Bateria UFABC",
            "looking_for": "Algo sério",
            "bio": "Dev full-stack de dia, ritmista da Bateria à noite. Se você curte maratona de séries, jogar videogame e rir de memes de programação, já temos match.",
            "interests": json.dumps(["Programação", "Samba", "Nintendo", "Gatos", "Pizza"]),
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "No intervalo entre as aulas você me encontra...",
            "prompt1_a": "No ensaio da bateria tirando o estresse na caixa.",
            "prompt2_q": "A matéria que quase me fez trancar o curso foi...",
            "prompt2_a": "Processamento da Informação com o temido C.",
            "prompt3_q": "Um date ideal pelo ABC ou Santo André tem...",
            "prompt3_a": "Hambúrguer artesanal no Bairro Jardim e muitas risadas.",
            "gender": "Homem",
            "target_gender": "Mulheres",
            "songs": json.dumps(["Criolo - Não Existe Amor em SP", "Kendrick Lamar - All The Stars", "Jorge Ben Jor - Taj Mahal"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Pegada firme e ritmo dentro e fora dos palcos. Me conquista com atitude e bom humor. Se pedir com carinho, eu libero o álbum secreto. 🔥",
            "is_admin": 0
        },
        {
            "ra": "11202021005",
            "password_hash": hash_password("123456"),
            "email": "camila.rocha@aluno.ufabc.edu.br",
            "name": "Camila Rocha",
            "age": 21,
            "campus": "São Bernardo do Campo",
            "course": "BC&H - Bacharelado em Ciências e Humanidades",
            "specific_course": "Ciências Econômicas",
            "entity": "Enactus UFABC",
            "looking_for": "Algo casual",
            "bio": "Economia em SBC, foco em projetos sociais com a Enactus. Adoro trilhas, gatos e experimentar cafés diferentes pelo ABC.",
            "interests": json.dumps(["Economia", "Sustentabilidade", "Trilhas", "Fotografia", "Yoga"]),
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "Minha opinião impopular sobre o RU...",
            "prompt1_a": "A opção vegetariana muitas vezes é mais gostosa que a tradicional.",
            "prompt2_q": "O melhor lugar para descansar na UFABC é...",
            "prompt2_a": "Os bancos sob as árvores no pátio de São Bernardo.",
            "prompt3_q": "Se você me pagar um salgado na lanchonete do Bloco A...",
            "prompt3_a": "Eu te passo os melhores resumos de Economia Política.",
            "gender": "Mulher",
            "target_gender": "Todos",
            "songs": json.dumps(["Liniker - Baby 95", "Silva - A Cor É Rosa", "Caetano Veloso - Sozinho"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Equilíbrio entre calmaria de dia e intensidade à noite. Se você for direto ao ponto, ganha pontos comigo. 💋",
            "is_admin": 0
        }
    ]

    for u in mock_users:
        # Insere ou atualiza os dados com RA e senha
        cursor.execute("""
            INSERT INTO users (
                ra, password_hash, email, name, age, campus, course, specific_course, entity,
                looking_for, bio, interests, photos,
                prompt1_q, prompt1_a, prompt2_q, prompt2_a, prompt3_q, prompt3_a,
                gender, target_gender, songs, private_photos, private_bio, is_admin
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
                ra = excluded.ra,
                password_hash = excluded.password_hash,
                gender = excluded.gender,
                target_gender = excluded.target_gender,
                songs = excluded.songs,
                private_photos = excluded.private_photos,
                private_bio = excluded.private_bio
        """, (
            u["ra"], u["password_hash"], u["email"], u["name"], u["age"], u["campus"], u["course"], u["specific_course"], u["entity"],
            u["looking_for"], u["bio"], u["interests"], u["photos"],
            u["prompt1_q"], u["prompt1_a"], u["prompt2_q"], u["prompt2_a"], u["prompt3_q"], u["prompt3_a"],
            u["gender"], u["target_gender"], u["songs"], u.get("private_photos", "[]"), u.get("private_bio", ""), u["is_admin"]
        ))

    # Criar um match inicial de exemplo entre Mariana (id=2) e Gabriel (id=5) para podermos testar o chat imediatamente
    # Buscar ids
    cursor.execute("SELECT id FROM users WHERE email = 'mariana.silva@aluno.ufabc.edu.br'")
    row_mariana = cursor.fetchone()
    cursor.execute("SELECT id FROM users WHERE email = 'gabriel.santos@aluno.ufabc.edu.br'")
    row_gabriel = cursor.fetchone()

    if row_mariana and row_gabriel:
        m_id = row_mariana["id"]
        g_id = row_gabriel["id"]
        # Criar swipe bilateral
        cursor.execute("INSERT OR IGNORE INTO swipes (from_user_id, to_user_id, action) VALUES (?, ?, 'like')", (m_id, g_id))
        cursor.execute("INSERT OR IGNORE INTO swipes (from_user_id, to_user_id, action) VALUES (?, ?, 'like')", (g_id, m_id))
        
        # Criar match
        cursor.execute("INSERT OR IGNORE INTO matches (user1_id, user2_id) VALUES (?, ?)", (min(m_id, g_id), max(m_id, g_id)))
        cursor.execute("SELECT id FROM matches WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)", (m_id, g_id, g_id, m_id))
        match_row = cursor.fetchone()
        
        if match_row:
            match_id = match_row["id"]
            # Mensagens de exemplo no chat
            cursor.execute("""
                INSERT OR IGNORE INTO messages (match_id, sender_id, text, created_at)
                VALUES (?, ?, 'Oi Mariana! Tudo bem? Vi que você também é do BC&T!', datetime('now', '-2 hours'))
            """, (match_id, g_id))
            cursor.execute("""
                INSERT OR IGNORE INTO messages (match_id, sender_id, text, created_at)
                VALUES (?, ?, 'Oie Gabriel! Tudo ótimo por aqui! Você toca na Bateria né? Sempre vejo os ensaios!', datetime('now', '-1 hour'))
            """, (match_id, m_id))
            cursor.execute("""
                INSERT OR IGNORE INTO messages (match_id, sender_id, text, created_at)
                VALUES (?, ?, 'Toco sim! Na caixa! Bora tomar um café no Bloco A qualquer dia desses?', datetime('now', '-30 minutes'))
            """, (match_id, g_id))

    conn.commit()
    conn.close()
    print("Dados iniciais semeados com sucesso!")

if __name__ == "__main__":
    seed_database()
