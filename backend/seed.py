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
    
    # Garante que os assets de GIF de exemplo estejam presentes em UPLOAD_DIR
    import os
    import shutil
    data_dir = Path(os.getenv("DATABASE_PATH", "/app/data/pontinho.db")).resolve().parent
    upload_dir = data_dir / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    seed_assets_dir = BACKEND_DIR / "seed_assets"
    if seed_assets_dir.exists():
        for asset in seed_assets_dir.glob("*.gif"):
            target = upload_dir / asset.name
            if not target.exists():
                shutil.copy2(asset, target)

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

    # 2. Entidades Estudantis
    entities = [
        ("Atlética Geral", "Associação Atlética Acadêmica"),
        ("Bateria Universitária", "A bateria mais ritmada e envolvente"),
        ("Caiás", "Torcida organizada e espírito universitário"),
        ("Baja", "Equipe de competição automobilística off-road"),
        ("Centro Acadêmico BC&T", "Representação dos alunos de Ciência e Tecnologia"),
        ("Centro Acadêmico BC&H", "Representação dos alunos de Humanidades"),
        ("Enactus", "Projetos de empreendedorismo social"),
        ("GPDA", "Grupo de Pesquisa e Desenvolvimento Aeroespacial"),
        ("Rocket Design", "Engenharia de minifoguetes experimentais"),
        ("IEEE Student Branch", "Inovação tecnológica e conferências de engenharia"),
        ("Nenhuma / Foco nos Estudos", "100% focado em sobreviver ao semestre")
    ]
    for name, desc in entities:
        cursor.execute("INSERT OR IGNORE INTO entities (name, description) VALUES (?, ?)", (name, desc))

    # 3. Perguntinhas de Perfil
    prompts = [
        "O melhor lugar para relaxar e fugir da rotina é...",
        "Minha técnica infalível pra quebrar o gelo...",
        "Minha opinião impopular sobre primeiro encontro...",
        "No intervalo entre as obrigações você me encontra...",
        "A matéria ou desafio que quase me enlouqueceu...",
        "Um date ideal no fim de noite tem...",
        "Se você me chamar pra sair agora..."
    ]
    for p in prompts:
        cursor.execute("INSERT OR IGNORE INTO prompts (question) VALUES (?)", (p,))

    # 4. Publicidades (Ads intercalados no feed)
    ads = [
        (
            "🍻 Festa Integração 2026",
            "A maior integração universitária! Open bar, 3 palcos e atrações imperdíveis. Lote 2 esgotando!",
            "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80",
            "Garantir Ingresso",
            "https://pontinho.app",
            1,
            3
        ),
        (
            "🖨️ Gráfica & Coworking Universitário",
            "Imprima suas apostilas, projetos e relatórios com desconto especial para membros do Pontinho.",
            "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80",
            "Pegar Cupom",
            "https://pontinho.app",
            1,
            4
        ),
        (
            "🦊 Kit Exclusivo & Caneca Oficial",
            "Caneca de tirante de alumínio 850ml, abadá e bandana exclusiva. Seja sócio-torcedor com valor promocional.",
            "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800&auto=format&fit=crop&q=80",
            "Pedir Kit",
            "https://pontinho.app",
            1,
            4
        )
    ]
    for title, desc, img, btn, link, active, freq in ads:
        cursor.execute("""
            INSERT OR IGNORE INTO ads (title, description, image_url, button_text, link_url, is_active, frequency)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (title, desc, img, btn, link, active, freq))

    # 5. 8 Perfis de Exemplo (+ 1 Administrador)
    mock_users = [
        {
            "ra": "admin",
            "password_hash": hash_password("admin123"),
            "email": "admin@pontinho.app",
            "name": "Administrador",
            "age": 28,
            "campus": "Santo André",
            "course": "BC&T - Bacharelado em Ciência e Tecnologia",
            "specific_course": "Ciência da Computação",
            "entity": "Centro Acadêmico BC&T",
            "looking_for": "Amizade",
            "bio": "Conta de administração do Pontinho. Modero as entidades, cursos e publicidades.",
            "interests": json.dumps(["Tecnologia", "Gestão", "Café", "Open Source"]),
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "O melhor lugar para relaxar e fugir da rotina é...",
            "prompt1_a": "No mezanino do Bloco A com um bom café e fone de ouvido.",
            "prompt2_q": "Minha opinião impopular sobre primeiro encontro...",
            "prompt2_a": "Conversa olho no olho supera qualquer restaurante sofisticado.",
            "prompt3_q": "No intervalo entre as obrigações você me encontra...",
            "prompt3_a": "Programando no laboratório ou testando novas ideias no Pontinho.",
            "gender": "Outro",
            "target_gender": "Todos",
            "songs": json.dumps(["Daft Punk - Harder Better Faster Stronger", "Kraftwerk - The Robots"]),
            "private_photos": json.dumps([]),
            "private_bio": "",
            "is_admin": 1
        },
        # Perfil 1: Mariana Silva
        {
            "ra": "11202021001",
            "password_hash": hash_password("123456"),
            "email": "mariana.silva@pontinho.app",
            "name": "Mariana Silva",
            "age": 21,
            "campus": "Santo André",
            "course": "BC&T - Bacharelado em Ciência e Tecnologia",
            "specific_course": "Neurociência",
            "entity": "Atlética Geral",
            "looking_for": "Algo sério",
            "bio": "Pesquisadora de neurociência, vôlei de praia e viciada em café com leite. Amo dias de sol, papos profundos e boa música.",
            "interests": json.dumps(["Vôlei", "Neurociência", "Café", "Praia", "Música Indie"]),
            "photos": json.dumps([
                "/uploads/gif_mariana.gif",
                "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "O melhor lugar para relaxar e fugir da rotina é...",
            "prompt1_a": "No gramado tomando sol ouvindo uma playlist tranquila nos dias sem prova.",
            "prompt2_q": "Minha opinião impopular sobre primeiro encontro...",
            "prompt2_a": "Date em café descontraído ou pastel na feira supera qualquer lugar caro.",
            "prompt3_q": "Um date ideal no fim de noite tem...",
            "prompt3_a": "Vinho tinto, risada fácil e zero pressa pra ir embora.",
            "gender": "Mulher",
            "target_gender": "Todos",
            "songs": json.dumps(["Chico Buarque - Construção", "Arctic Monkeys - 505", "Duda Beat - Bixinho"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1516726817505-f5ed825624d8?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "De dia pareço tímida e focada, mas adoro noites animadas, beijo demorado e química sem tabu. Quer descobrir mais? 🔥",
            "is_admin": 0
        },
        # Perfil 2: Lucas Mendes
        {
            "ra": "11202021002",
            "password_hash": hash_password("123456"),
            "email": "lucas.mendes@pontinho.app",
            "name": "Lucas Mendes",
            "age": 22,
            "campus": "São Bernardo do Campo",
            "course": "BC&H - Bacharelado em Ciências e Humanidades",
            "specific_course": "Relações Internacionais",
            "entity": "Caiás",
            "looking_for": "Algo casual",
            "bio": "Relações Internacionais. Me chama pra tomar uma cerveja depois das 21h ou debater geopolítica. Gosto de cinema cult e viajar na estrada.",
            "interests": json.dumps(["Cinema", "Geopolítica", "Cervejada", "Livros", "Rock"]),
            "photos": json.dumps([
                "/uploads/gif_lucas.gif",
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "Minha opinião impopular sobre primeiro encontro...",
            "prompt1_a": "Se o papo não fluir nos primeiros 15 minutos, pedir a saideira é sinal de maturidade.",
            "prompt2_q": "No intervalo entre as obrigações você me encontra...",
            "prompt2_a": "No pátio tomando uma com quem quiser trocar ideia boa.",
            "prompt3_q": "Um date ideal no fim de noite tem...",
            "prompt3_a": "Carona ouvindo indie rock pelas avenidas desertas da cidade.",
            "gender": "Homem",
            "target_gender": "Mulheres",
            "songs": json.dumps(["Tame Impala - The Less I Know The Better", "Tim Maia - Não Quero Dinheiro", "The Strokes - Someday"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Gosto de olhares provocantes, pele quente e química daquelas que não precisa de explicação formal. 😉",
            "is_admin": 0
        },
        # Perfil 3: Bia Costa
        {
            "ra": "11202021003",
            "password_hash": hash_password("123456"),
            "email": "beatriz.costa@pontinho.app",
            "name": "Bia Costa",
            "age": 20,
            "campus": "Santo André",
            "course": "BC&T - Bacharelado em Ciência e Tecnologia",
            "specific_course": "Engenharia Aeroespacial",
            "entity": "Rocket Design",
            "looking_for": "Amizade",
            "bio": "Quero mandar foguetes pro espaço 🚀. Quando não estou em projetos de propulsão, estou maratonando sci-fi ou ouvindo Taylor Swift.",
            "interests": json.dumps(["Astronomia", "Foguetes", "Taylor Swift", "Anime", "Jogos"]),
            "photos": json.dumps([
                "/uploads/gif_bia.gif",
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "O melhor lugar para relaxar e fugir da rotina é...",
            "prompt1_a": "O mezanino silencioso da biblioteca no final da tarde.",
            "prompt2_q": "Se você me chamar pra sair agora...",
            "prompt2_a": "Eu aceito se envolver açaí ou hambúrguer bem recheado.",
            "prompt3_q": "Minha técnica infalível pra quebrar o gelo...",
            "prompt3_a": "Perguntar qual teoria da conspiração você secretamente acredita.",
            "gender": "Mulher",
            "target_gender": "Todos",
            "songs": json.dumps(["Taylor Swift - Cruel Summer", "Daft Punk - Instant Crush", "Coldplay - Yellow"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Mente lógica com um lado nada comportado: beijo no pescoço, quarto escuro e conexões que pegam fogo. Me peça acesso. 🚀✨",
            "is_admin": 0
        },
        # Perfil 4: Gabriel Santos
        {
            "ra": "11202021004",
            "password_hash": hash_password("123456"),
            "email": "gabriel.santos@pontinho.app",
            "name": "Gabriel Santos",
            "age": 23,
            "campus": "Santo André",
            "course": "BC&T - Bacharelado em Ciência e Tecnologia",
            "specific_course": "Ciência da Computação",
            "entity": "Bateria Universitária",
            "looking_for": "Algo sério",
            "bio": "Programador de dia, ritmista da bateria à noite. Curto maratona de séries, jogar videogame e rir de memes de tecnologia.",
            "interests": json.dumps(["Programação", "Samba", "Nintendo", "Gatos", "Pizza"]),
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "No intervalo entre as obrigações você me encontra...",
            "prompt1_a": "No ensaio tirando o estresse na caixa ou jogando Smash.",
            "prompt2_q": "A matéria ou desafio que quase me enlouqueceu...",
            "prompt2_a": "Entender ponteiros em C na primeira semana do semestre.",
            "prompt3_q": "Um date ideal no fim de noite tem...",
            "prompt3_a": "Hambúrguer artesanal e aquela sintonia que não cansa.",
            "gender": "Homem",
            "target_gender": "Mulheres",
            "songs": json.dumps(["Criolo - Não Existe Amor em SP", "Kendrick Lamar - All The Stars", "Jorge Ben Jor - Taj Mahal"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Pegada firme e ritmo intenso dentro e fora dos palcos. Me conquista com atitude e iniciativa. Se pedir com carinho, libero meu álbum secreto. 🔥",
            "is_admin": 0
        },
        # Perfil 5: Camila Rocha
        {
            "ra": "11202021005",
            "password_hash": hash_password("123456"),
            "email": "camila.rocha@pontinho.app",
            "name": "Camila Rocha",
            "age": 21,
            "campus": "São Bernardo do Campo",
            "course": "BC&H - Bacharelado em Ciências e Humanidades",
            "specific_course": "Ciências Econômicas",
            "entity": "Enactus",
            "looking_for": "Algo casual",
            "bio": "Economia e sustentabilidade. Adoro trilhas, gatos e descobrir cafeterias aconchegantes para ler ou prosear.",
            "interests": json.dumps(["Economia", "Sustentabilidade", "Trilhas", "Fotografia", "Yoga"]),
            "photos": json.dumps([
                "/uploads/gif_camila.gif",
                "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "Minha opinião impopular sobre primeiro encontro...",
            "prompt1_a": "Quem escolhe o local primeiro tem direito a provar a sobremesa do outro.",
            "prompt2_q": "O melhor lugar para relaxar e fugir da rotina é...",
            "prompt2_a": "No meio da natureza respirando ar puro e sem sinal no celular.",
            "prompt3_q": "Se você me chamar pra sair agora...",
            "prompt3_a": "Coloco meu melhor look em 15 minutos e topo a aventura.",
            "gender": "Mulher",
            "target_gender": "Todos",
            "songs": json.dumps(["Liniker - Baby 95", "Silva - A Cor É Rosa", "Caetano Veloso - Sozinho"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Equilíbrio entre calmaria de dia e intensidade quente à noite. Se você for ousado e direto ao ponto, ganha pontos comigo. 💋",
            "is_admin": 0
        },
        # Perfil 6: Rodrigo Alves
        {
            "ra": "11202021006",
            "password_hash": hash_password("123456"),
            "email": "rodrigo.alves@pontinho.app",
            "name": "Rodrigo Alves",
            "age": 24,
            "campus": "Santo André",
            "course": "BC&T - Bacharelado em Ciência e Tecnologia",
            "specific_course": "Engenharia de Gestão",
            "entity": "Baja",
            "looking_for": "Algo sério",
            "bio": "Treino pesado, fã de eletrônica e viagens de última hora. Gosto de quem tem energia contagiante e não tem medo de viver momentos intensos.",
            "interests": json.dumps(["Musculação", "Baja", "Eletrônica", "Viagens", "Churrasco"]),
            "photos": json.dumps([
                "/uploads/gif_rodrigo.gif",
                "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "Minha opinião impopular sobre primeiro encontro...",
            "prompt1_a": "Primeiro date tem que ter energia lá em cima, nada de sono ou lamentação.",
            "prompt2_q": "Se você me chamar pra sair agora...",
            "prompt2_a": "Passo aí em meia hora e a gente decide o destino na estrada.",
            "prompt3_q": "Um date ideal no fim de noite tem...",
            "prompt3_a": "Música alta, beijo que rouba o fôlego e vontade de não dormir.",
            "gender": "Homem",
            "target_gender": "Mulheres",
            "songs": json.dumps(["The Weeknd - Blinding Lights", "Vintage Culture - In The Dark", "Alok - Hear Me Now"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1480429370139-e0132c086e2a?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Gosto de conduzir, abraço forte e uma boa dose de adrenalina a dois. Quer ver o que não mostro pra qualquer um? Clica em pedir acesso. 🔥",
            "is_admin": 0
        },
        # Perfil 7: Isabela Martins
        {
            "ra": "11202021007",
            "password_hash": hash_password("123456"),
            "email": "isabela.martins@pontinho.app",
            "name": "Isabela Martins",
            "age": 22,
            "campus": "Santo André",
            "course": "BC&T - Bacharelado em Ciência e Tecnologia",
            "specific_course": "Biotecnologia",
            "entity": "Centro Acadêmico BC&T",
            "looking_for": "Algo casual",
            "bio": "Pesquisadora de bancada, fã de festivais e apaixonada por vinho tinto. Se você tiver papo interessante e me fizer rir, metade do caminho tá feito.",
            "interests": json.dumps(["Biotecnologia", "Vinho", "Festivais", "Moda", "Fotografia"]),
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "Minha técnica infalível pra quebrar o gelo...",
            "prompt1_a": "Olhar nos olhos, dar um sorriso de lado e dizer o que ninguém tem coragem de falar.",
            "prompt2_q": "O melhor lugar para relaxar e fugir da rotina é...",
            "prompt2_a": "Em um rooftop tomando um drink com boa vista.",
            "prompt3_q": "Um date ideal no fim de noite tem...",
            "prompt3_a": "Provocações sutis que viram algo muito mais quente.",
            "gender": "Mulher",
            "target_gender": "Todos",
            "songs": json.dumps(["Dua Lipa - Levitating", "Doja Cat - Kiss Me More", "Marina Sena - Por Supuesto"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Intensa, curiosa e sem tempo pra joguinhos mornos. Gosto de cumplicidade quente entre quatro paredes. Peça acesso se tiver atitude. 😉✨",
            "is_admin": 0
        },
        # Perfil 8: Felipe Ramos
        {
            "ra": "11202021008",
            "password_hash": hash_password("123456"),
            "email": "felipe.ramos@pontinho.app",
            "name": "Felipe Ramos",
            "age": 23,
            "campus": "São Bernardo do Campo",
            "course": "BC&H - Bacharelado em Ciências e Humanidades",
            "specific_course": "Ciências Econômicas",
            "entity": "Caiás",
            "looking_for": "Algo casual",
            "bio": "Debates acalorados, hip-hop, basquete de rua e rolês espontâneos. Se o plano for bom e a companhia melhor ainda, tô dentro.",
            "interests": json.dumps(["Hip-Hop", "Basquete", "Economia", "Streetwear", "Cinema"]),
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "A matéria ou desafio que quase me enlouqueceu...",
            "prompt1_a": "Provas longas de cálculo emendadas com entrega de artigo no mesmo dia.",
            "prompt2_q": "Minha opinião impopular sobre primeiro encontro...",
            "prompt2_a": "Se não houver química no beijo, não adianta forçar segundo date.",
            "prompt3_q": "Um date ideal no fim de noite tem...",
            "prompt3_a": "Conversa sussurrada e zero vontade de ir embora.",
            "gender": "Homem",
            "target_gender": "Mulheres",
            "songs": json.dumps(["Baco Exu do Blues - Me Desculpa Jay Z", "Djonga - Leal", "Matuê - Anos Luz"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Voz firme, beijo com pegada e zero limites pra quem desperta meu lado mais quente. Vem conferir. 🔥",
            "is_admin": 0
        },
        # Perfil 9: Larissa Prado
        {
            "ra": "11202021009",
            "password_hash": hash_password("123456"),
            "email": "larissa.prado@pontinho.app",
            "name": "Larissa Prado",
            "age": 21,
            "campus": "Santo André",
            "course": "BC&T - Bacharelado em Ciência e Tecnologia",
            "specific_course": "Engenharia Biomédica",
            "entity": "GPDA",
            "looking_for": "Algo sério",
            "bio": "Pesquisadora de biomateriais e próteses. Viciada em corrida de rua, café gelado e dias ensolarados no campus. Adoro rir de coisas bobas e conversar sobre o futuro.",
            "interests": json.dumps(["Engenharia", "Corrida", "Café Gelado", "Séries", "Biomateriais"]),
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "O melhor lugar para relaxar e fugir da rotina é...",
            "prompt1_a": "Correndo na pista do campus no fim de tarde ouvindo música pop animada.",
            "prompt2_q": "Se você me chamar pra sair agora...",
            "prompt2_a": "Topo na hora se for pra comer uma sobremesa boa ou tomar um açaí caprichado.",
            "prompt3_q": "Minha técnica infalível pra quebrar o gelo...",
            "prompt3_a": "Elogiar o tênis ou perguntar qual matéria tá tirando seu sono essa semana.",
            "gender": "Mulher",
            "target_gender": "Todos",
            "songs": json.dumps(["Dua Lipa - Dance The Night", "Marina Sena - Dano Sarrada", "Harry Styles - As It Was"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Tenho jeito de certinha na sala de aula, mas quem me conhece de verdade sabe que tenho um lado provocante e cheio de atitude. Me manda pedido! 😉",
            "is_admin": 0
        },
        # Perfil 10: Thiago Oliveira
        {
            "ra": "11202021010",
            "password_hash": hash_password("123456"),
            "email": "thiago.oliveira@pontinho.app",
            "name": "Thiago Oliveira",
            "age": 24,
            "campus": "São Bernardo do Campo",
            "course": "BC&H - Bacharelado em Ciências e Humanidades",
            "specific_course": "Filosofia",
            "entity": "Nenhuma / Foco nos Estudos",
            "looking_for": "Algo sério",
            "bio": "Filosofia e literatura. Apaixonado por vinis antigos, cafés especiais filtrados e papos que duram até o amanhecer. Busco conexões que façam o coração bater no ritmo certo.",
            "interests": json.dumps(["Filosofia", "Café Especial", "Vinis", "Jazz", "Literatura"]),
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "Minha opinião impopular sobre primeiro encontro...",
            "prompt1_a": "Livraria charmosa com cafeteria no fundo dá de dez a zero em qualquer balada barulhenta.",
            "prompt2_q": "Um date ideal no fim de noite tem...",
            "prompt2_a": "Caminhada calma com céu estrelado, jaqueta emprestada e silêncios confortáveis.",
            "prompt3_q": "No intervalo entre as obrigações você me encontra...",
            "prompt3_a": "No cantinho da biblioteca lendo Sartre ou trocando ideia no banco de madeira.",
            "gender": "Homem",
            "target_gender": "Mulheres",
            "songs": json.dumps(["Miles Davis - So What", "Belchior - Apenas um Rapaz Latino-Americano", "Chet Baker - I Fall In Love Too Easily"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Por trás da calma e dos livros, gosto de intensidade, beijo que não pede licença e olhares que desarmam. Quer conferir? 🔥",
            "is_admin": 0
        },
        # Perfil 11: Juliana Freitas
        {
            "ra": "11202021011",
            "password_hash": hash_password("123456"),
            "email": "juliana.freitas@pontinho.app",
            "name": "Juliana Freitas",
            "age": 22,
            "campus": "Santo André",
            "course": "BC&T - Bacharelado em Ciência e Tecnologia",
            "specific_course": "Engenharia Ambiental e Urbana",
            "entity": "Enactus",
            "looking_for": "Amizade",
            "bio": "Futura engenheira ambiental. Ciclista nas horas vagas, apaixonada por botânica e cerveja artesanal. Vamos pedalar até a Represa Billings ou tomar uma IPA gelada?",
            "interests": json.dumps(["Bicicleta", "Sustentabilidade", "Cerveja Artesanal", "Plantas", "MPB"]),
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "O melhor lugar para relaxar e fugir da rotina é...",
            "prompt1_a": "Parque Celso Daniel em um sábado ensolarado com canga na grama e amigos.",
            "prompt2_q": "Se você me chamar pra sair agora...",
            "prompt2_a": "Se tiver petisco vegetariano e bebida refrescante, já tô calçando o tênis.",
            "prompt3_q": "Minha técnica infalível pra quebrar o gelo...",
            "prompt3_a": "Perguntar quantas plantas você já conseguiu manter vivas por mais de um ano.",
            "gender": "Mulher",
            "target_gender": "Todos",
            "songs": json.dumps(["Gilsons - Várias Queixas", "Luedji Luna - Banho de Folhas", "Alceu Valença - Anunciação"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Espírito livre, sorriso fácil e carinho que arrepia. Deixo minhas fotos secretas pra quem demonstrar interesse de verdade. ✨",
            "is_admin": 0
        },
        # Perfil 12: Mateus Chen
        {
            "ra": "11202021012",
            "password_hash": hash_password("123456"),
            "email": "mateus.chen@pontinho.app",
            "name": "Mateus Chen",
            "age": 20,
            "campus": "Santo André",
            "course": "BC&T - Bacharelado em Ciência e Tecnologia",
            "specific_course": "Ciência da Computação",
            "entity": "IEEE Student Branch",
            "looking_for": "Algo casual",
            "bio": "Programo em Rust e TypeScript, viciado em hackathons e jogos de ritmo. Amo comida asiática, teclados mecânicos e descobrir novos lugares no ABC.",
            "interests": json.dumps(["Rust", "Hackathons", "Ramen", "Games", "Synthwave"]),
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "A matéria ou desafio que quase me enlouqueceu...",
            "prompt1_a": "Teoria dos Grafos às 8h da manhã em uma segunda-feira chuvosa.",
            "prompt2_q": "Minha opinião impopular sobre primeiro encontro...",
            "prompt2_a": "Jogar coop ou arcade juntos é o melhor teste de compatibilidade que existe.",
            "prompt3_q": "No intervalo entre as obrigações você me encontra...",
            "prompt3_a": "No Bloco B disputando quem compila o código mais rápido.",
            "gender": "Homem",
            "target_gender": "Todos",
            "songs": json.dumps(["The Midnight - Sunset", "Gunship - Tech Noir", "Daft Punk - Digital Love"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Gosto de cumplicidade sem rodeios, toques demorados e química no ponto. Curioso(a)? Só pedir acesso. 🔥",
            "is_admin": 0
        },
        # Perfil 13: Carolina Meireles
        {
            "ra": "11202021013",
            "password_hash": hash_password("123456"),
            "email": "carolina.meireles@pontinho.app",
            "name": "Carolina Meireles",
            "age": 23,
            "campus": "São Bernardo do Campo",
            "course": "BC&H - Bacharelado em Ciências e Humanidades",
            "specific_course": "Relações Internacionais",
            "entity": "Atlética Geral",
            "looking_for": "Algo sério",
            "bio": "Futura diplomata, poliglota e apaixonada por geopolítica. Nas horas vagas sou capitã de handebol e fã incondicional de massas italianas.",
            "interests": json.dumps(["Handebol", "Idiomas", "Viagens", "Vinho", "Geopolítica"]),
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "Um date ideal no fim de noite tem...",
            "prompt1_a": "Risotto feito a quatro mãos, taça de vinho e boas gargalhadas na cozinha.",
            "prompt2_q": "Minha opinião impopular sobre primeiro encontro...",
            "prompt2_a": "Pessoa que trata bem garçom e funcionários já ganha 90% do meu coração.",
            "prompt3_q": "Se você me chamar pra sair agora...",
            "prompt3_a": "Aceito se for um lugar aconchegante com música ao vivo e iluminação baixa.",
            "gender": "Mulher",
            "target_gender": "Homens",
            "songs": json.dumps(["Rosalía - Despechá", "Stromae - Santé", "Anavitória - Porque Eu Te Amo"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Postura elegante em público, mas entre quatro paredes adoro intensidade, pegada sem pudores e intimidade quente. 💋",
            "is_admin": 0
        },
        # Perfil 14: Pedro Henrique (PH)
        {
            "ra": "11202021014",
            "password_hash": hash_password("123456"),
            "email": "pedro.henrique@pontinho.app",
            "name": "Pedro Henrique (PH)",
            "age": 22,
            "campus": "Santo André",
            "course": "BC&T - Bacharelado em Ciência e Tecnologia",
            "specific_course": "Engenharia Aeroespacial",
            "entity": "Rocket Design",
            "looking_for": "Algo casual",
            "bio": "Engenharia Aeroespacial e piloto de kart amador nas horas vagas. Gosto de churrasco com amigos, sertanejo modão, rock clássico e quem sabe o que quer.",
            "interests": json.dumps(["Kart", "Aeroespacial", "Churrasco", "Rock Clássico", "Fórmula 1"]),
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "Se você me chamar pra sair agora...",
            "prompt1_a": "Pego o carro, coloco uma playlist boa e a gente vai comer na melhor hamburgueria da região.",
            "prompt2_q": "Minha opinião impopular sobre primeiro encontro...",
            "prompt2_a": "Date formal de cinema é furada; o bom mesmo é lugar onde dá pra conversar de verdade.",
            "prompt3_q": "No intervalo entre as obrigações você me encontra...",
            "prompt3_a": "Calculando trajetórias ou assistindo vídeos de onboard da F1 no pátio.",
            "gender": "Homem",
            "target_gender": "Mulheres",
            "songs": json.dumps(["Led Zeppelin - Whole Lotta Love", "Queen - Don't Stop Me Now", "Engenheiros do Hawaii - Infinita Highway"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Curto abraço apertado, beijo que rouba o ar e momentos que marcam sem complicação. Vem ver o resto no privado. 🚀",
            "is_admin": 0
        },
        # Perfil 15: Luana Vasconcelos
        {
            "ra": "11202021015",
            "password_hash": hash_password("123456"),
            "email": "luana.vasconcelos@pontinho.app",
            "name": "Luana Vasconcelos",
            "age": 20,
            "campus": "São Bernardo do Campo",
            "course": "LCH - Licenciatura em Ciências Humanas",
            "specific_course": "Filosofia",
            "entity": "Centro Acadêmico BC&H",
            "looking_for": "Amizade",
            "bio": "Estudante de humanidades, poetisa de bloco de notas e defensora de causas sociais. Apaixonada por cinema independente, gatos malhados e debates no gramado do campus.",
            "interests": json.dumps(["Poesia", "Cinema Independente", "Gatos", "Humanidades", "Teatro"]),
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "O melhor lugar para relaxar e fugir da rotina é...",
            "prompt1_a": "Debaixo das árvores do campus SBC escrevendo crônicas ou ouvindo MPB no fone.",
            "prompt2_q": "Minha técnica infalível pra quebrar o gelo...",
            "prompt2_a": "Perguntar qual foi o último filme que te fez chorar sem vergonha.",
            "prompt3_q": "Um date ideal no fim de noite tem...",
            "prompt3_a": "Chá quente, coberta dividida e conversas existenciais sobre o universo.",
            "gender": "Mulher",
            "target_gender": "Todos",
            "songs": json.dumps(["Gal Costa - Baby", "Clara Nunes - O Mar Serenou", "Letrux - Ninguém Perguntou Por Você"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Sensível e profunda por fora, mas com uma chama ardente que surpreende quem ganha minha confiança. Peça acesso se quiser desvendar. ✨",
            "is_admin": 0
        },
        # Perfil 16: Rafael Duarte
        {
            "ra": "11202021016",
            "password_hash": hash_password("123456"),
            "email": "rafael.duarte@pontinho.app",
            "name": "Rafael Duarte",
            "age": 25,
            "campus": "Santo André",
            "course": "BC&T - Bacharelado em Ciência e Tecnologia",
            "specific_course": "Engenharia de Informação",
            "entity": "Bateria Universitária",
            "looking_for": "Algo casual",
            "bio": "Redes, segurança da informação e percussão pesada na Bateria. Final de semana é praia pra surfar no litoral ou festival eletrônico até de manhã.",
            "interests": json.dumps(["Surfe", "Percussão", "Techno", "Segurança da Informação", "Praia"]),
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1480429370139-e0132c086e2a?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "No intervalo entre as obrigações você me encontra...",
            "prompt1_a": "Afinando os instrumentos da bateria ou planejando a próxima viagem pra Maresias.",
            "prompt2_q": "Minha opinião impopular sobre primeiro encontro...",
            "prompt2_a": "Se não rolar sintonia de humor e piada interna rápida, não vai pra frente.",
            "prompt3_q": "Se você me chamar pra sair agora...",
            "prompt3_a": "Bora pra um barzinho com música animada e cerveja bem gelada.",
            "gender": "Homem",
            "target_gender": "Mulheres",
            "songs": json.dumps(["Boris Brejcha - Gravity", "Fisher - Losing It", "Natiruts - Sorri, Sou Rei"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Pele salgada do mar, energia pra dar e vender e aquela pegada que não dá pra esquecer fácil. Quer ver mais? Pede o privado. 🔥",
            "is_admin": 0
        },
        # Perfil 17: Helena Borges
        {
            "ra": "11202021017",
            "password_hash": hash_password("123456"),
            "email": "helena.borges@pontinho.app",
            "name": "Helena Borges",
            "age": 21,
            "campus": "Santo André",
            "course": "BC&T - Bacharelado em Ciência e Tecnologia",
            "specific_course": "Biotecnologia",
            "entity": "Atlética Geral",
            "looking_for": "Algo sério",
            "bio": "Biotecnologia e apaixonada por genética molecular. Atleta de natação pela Atlética, viciada em praia, brigadeiro de panela e playlists de pop anos 2000.",
            "interests": json.dumps(["Natação", "Biotecnologia", "Pop 2000", "Praia", "Doces"]),
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "Minha técnica infalível pra quebrar o gelo...",
            "prompt1_a": "Cantarolar um refrão marcante da Britney ou Rihanna e ver se você acompanha.",
            "prompt2_q": "O melhor lugar para relaxar e fugir da rotina é...",
            "prompt2_a": "Dando braçadas na piscina depois de um dia exaustivo de laboratório.",
            "prompt3_q": "Um date ideal no fim de noite tem...",
            "prompt3_a": "Gargalhadas sinceras, sobremesa dividida e aquela química palpável no ar.",
            "gender": "Mulher",
            "target_gender": "Todos",
            "songs": json.dumps(["Britney Spears - Toxic", "Rihanna - Only Girl", "Luísa Sonza - Chico"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Sorriso doce de menina, mas pegada firme e decidida de mulher. Se você despertar minha curiosidade, libero as melhores fotos. 💋",
            "is_admin": 0
        },
        # Perfil 18: Arthur Zanin
        {
            "ra": "11202021018",
            "password_hash": hash_password("123456"),
            "email": "arthur.zanin@pontinho.app",
            "name": "Arthur Zanin",
            "age": 23,
            "campus": "Santo André",
            "course": "BC&T - Bacharelado em Ciência e Tecnologia",
            "specific_course": "Engenharia de Materiais",
            "entity": "Baja",
            "looking_for": "Algo sério",
            "bio": "Engenharia de Materiais e mecânico da equipe de Baja. Na oficina mexo com solda e suspensão; em casa sou cozinheiro amador que faz as melhores massas do ABC.",
            "interests": json.dumps(["Baja", "Culinária", "Engenharia de Materiais", "Mecânica", "Cinema"]),
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80"
            ]),
            "prompt1_q": "Se você me chamar pra sair agora...",
            "prompt1_a": "Te convido pra vir aqui em casa experimentar meu carbonara feito do zero com pancetta.",
            "prompt2_q": "Minha opinião impopular sobre primeiro encontro...",
            "prompt2_a": "Cozinhar juntos no primeiro ou segundo encontro é muito mais divertido do que restaurante formal.",
            "prompt3_q": "No intervalo entre as obrigações você me encontra...",
            "prompt3_a": "Com a mão suja de graxa na oficina do Baja afinando o carro de competição.",
            "gender": "Homem",
            "target_gender": "Mulheres",
            "songs": json.dumps(["Dire Straits - Sultans of Swing", "Pink Floyd - Time", "Raul Seixas - Metamorfose Ambulante"]),
            "private_photos": json.dumps([
                "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80"
            ]),
            "private_bio": "Mãos firmes de quem trabalha com metal e coração que esquenta rápido quando bate a química certa. Peça acesso ao meu álbum secreto. 🔥",
            "is_admin": 0
        }
    ]

    for u in mock_users:
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
                name = excluded.name,
                age = excluded.age,
                campus = excluded.campus,
                course = excluded.course,
                specific_course = excluded.specific_course,
                entity = excluded.entity,
                looking_for = excluded.looking_for,
                bio = excluded.bio,
                interests = excluded.interests,
                photos = excluded.photos,
                prompt1_q = excluded.prompt1_q,
                prompt1_a = excluded.prompt1_a,
                prompt2_q = excluded.prompt2_q,
                prompt2_a = excluded.prompt2_a,
                prompt3_q = excluded.prompt3_q,
                prompt3_a = excluded.prompt3_a,
                gender = excluded.gender,
                target_gender = excluded.target_gender,
                songs = excluded.songs,
                private_photos = excluded.private_photos,
                private_bio = excluded.private_bio,
                is_admin = excluded.is_admin
        """, (
            u["ra"], u["password_hash"], u["email"], u["name"], u["age"], u["campus"], u["course"], u["specific_course"], u["entity"],
            u["looking_for"], u["bio"], u["interests"], u["photos"],
            u["prompt1_q"], u["prompt1_a"], u["prompt2_q"], u["prompt2_a"], u["prompt3_q"], u["prompt3_a"],
            u["gender"], u["target_gender"], u["songs"], u.get("private_photos", "[]"), u.get("private_bio", ""), u["is_admin"]
        ))

    # Match de exemplo entre Mariana (id=2) e Gabriel (id=5) para podermos testar o chat e pedidos privados imediatamente
    cursor.execute("SELECT id FROM users WHERE email = 'mariana.silva@pontinho.app'")
    row_mariana = cursor.fetchone()
    cursor.execute("SELECT id FROM users WHERE email = 'gabriel.santos@pontinho.app'")
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
                VALUES (?, ?, 'Oi Mariana! Tudo bem? Vi que você também curte indie e vôlei!', datetime('now', '-2 hours'))
            """, (match_id, g_id))
            cursor.execute("""
                INSERT OR IGNORE INTO messages (match_id, sender_id, text, created_at)
                VALUES (?, ?, 'Oie Gabriel! Tudo ótimo! Você toca na Bateria né? Curti muito sua vibe!', datetime('now', '-1 hour'))
            """, (match_id, m_id))
            cursor.execute("""
                INSERT OR IGNORE INTO messages (match_id, sender_id, text, created_at)
                VALUES (?, ?, 'Toco sim! Na caixa! Bora tomar um drink ou café qualquer dia desses?', datetime('now', '-30 minutes'))
            """, (match_id, g_id))

    # Match de exemplo 2: Larissa (larissa.prado) e Thiago (thiago.oliveira)
    cursor.execute("SELECT id FROM users WHERE email = 'larissa.prado@pontinho.app'")
    row_larissa = cursor.fetchone()
    cursor.execute("SELECT id FROM users WHERE email = 'thiago.oliveira@pontinho.app'")
    row_thiago = cursor.fetchone()

    if row_larissa and row_thiago:
        l_id = row_larissa["id"]
        t_id = row_thiago["id"]
        cursor.execute("INSERT OR IGNORE INTO swipes (from_user_id, to_user_id, action) VALUES (?, ?, 'like')", (l_id, t_id))
        cursor.execute("INSERT OR IGNORE INTO swipes (from_user_id, to_user_id, action) VALUES (?, ?, 'like')", (t_id, l_id))
        cursor.execute("INSERT OR IGNORE INTO matches (user1_id, user2_id) VALUES (?, ?)", (min(l_id, t_id), max(l_id, t_id)))
        cursor.execute("SELECT id FROM matches WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)", (l_id, t_id, t_id, l_id))
        m2_row = cursor.fetchone()
        if m2_row:
            m2_id = m2_row["id"]
            cursor.execute("""
                INSERT OR IGNORE INTO messages (match_id, sender_id, text, created_at)
                VALUES (?, ?, 'Oi Larissa! Vi que você pesquisa biomateriais, achei incrível!', datetime('now', '-3 hours'))
            """, (m2_id, t_id))
            cursor.execute("""
                INSERT OR IGNORE INTO messages (match_id, sender_id, text, created_at)
                VALUES (?, ?, 'Oie Thiago! Obrigada! E você em Filosofia, adoro conversar sobre esses temas.', datetime('now', '-2 hours'))
            """, (m2_id, l_id))

    # 8. Festas e Eventos Universitários da UFABC
    cursor.execute("SELECT id FROM users WHERE is_admin = 1 LIMIT 1")
    admin_row = cursor.fetchone()
    admin_id = admin_row["id"] if admin_row else 1

    sample_events = [
        {
            "title": "Cervejada Geral UFABC",
            "description": "A maior cervejada universitária do Grande ABC com 6h de open bar com cerveja trincando, gummy e beats. Pista com DJ residente, funk universitário, eletrônica e a Bateria Universitária ao vivo!",
            "event_date": "2026-11-14 22:00",
            "location": "Espaço Modular - Santo André (Av. dos Estados)",
            "image_url": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1000&auto=format&fit=crop&q=80",
            "ticket_url": "https://blacktag.com.br",
            "created_by": admin_id
        },
        {
            "title": "Bixolândia Integração",
            "description": "Tradicional integração entre calouros e veteranos da UFABC. Apresentação da Bateria Universitária, roda de samba, chopp em dobro e ativações especiais do Pontinho!",
            "event_date": "2026-11-21 18:00",
            "location": "Galpão Universitário - São Bernardo do Campo",
            "image_url": "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1000&auto=format&fit=crop&q=80",
            "ticket_url": "https://byinti.com",
            "created_by": admin_id
        },
        {
            "title": "Noite do Branco Atlética",
            "description": "O encerramento do quadrimestre com estilo! Traje branco obrigatório. Pista principal com música ao vivo, lounge eletrônico e open bar premium com drinks especiais.",
            "event_date": "2026-12-05 23:00",
            "location": "Mansão Santo André - Grand Eventos",
            "image_url": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1000&auto=format&fit=crop&q=80",
            "ticket_url": "https://blacktag.com.br",
            "created_by": admin_id
        }
    ]

    for ev in sample_events:
        cursor.execute("SELECT id FROM events WHERE title = ?", (ev["title"],))
        existing_ev = cursor.fetchone()
        if not existing_ev:
            cursor.execute("""
                INSERT INTO events (title, description, event_date, location, image_url, ticket_url, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (ev["title"], ev["description"], ev["event_date"], ev["location"], ev["image_url"], ev["ticket_url"], ev["created_by"]))

    # Presenças confirmadas de exemplo com usuários reais da base
    cursor.execute("SELECT id FROM users WHERE is_admin = 0 LIMIT 10")
    active_user_ids = [r["id"] for r in cursor.fetchall()]

    cursor.execute("SELECT id FROM events WHERE title LIKE 'Cervejada%'")
    ev1 = cursor.fetchone()
    if ev1 and active_user_ids:
        ev1_id = ev1["id"]
        for uid in active_user_ids[:6]:
            cursor.execute("""
                INSERT OR IGNORE INTO event_attendees (event_id, user_id, status)
                VALUES (?, ?, 'going')
            """, (ev1_id, uid))

    cursor.execute("SELECT id FROM events WHERE title LIKE 'Bixolândia%'")
    ev2 = cursor.fetchone()
    if ev2 and active_user_ids:
        ev2_id = ev2["id"]
        for uid in active_user_ids[2:8]:
            cursor.execute("""
                INSERT OR IGNORE INTO event_attendees (event_id, user_id, status)
                VALUES (?, ?, 'going')
            """, (ev2_id, uid))

    conn.commit()
    conn.close()
    print("Base recriada com sucesso com perfis, festas/eventos e presenças confirmadas!")

if __name__ == "__main__":
    seed_database()
