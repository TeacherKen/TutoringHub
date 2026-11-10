from PIL import Image, ImageDraw, ImageFilter, ImageOps
import math, os
K='/home/claude/shorepine/kenney/2d/'
A='/home/claude/tutoringhub/public/games/art/'
OUT=A+'logos/'
W,H=480,300
def L(p):
    return Image.open(p if p.startswith('/') else K+p).convert('RGBA')
def bg_tile(p, scale=None):
    im=L(p); s=H/im.height if scale is None else scale
    im=im.resize((max(1,int(im.width*s)),max(1,int(im.height*s))),Image.LANCZOS)
    c=Image.new('RGBA',(W,H))
    x=0
    while x<W:
        c.alpha_composite(im,(x,H-im.height)); x+=im.width
    return c
def grad(top,bot):
    c=Image.new('RGBA',(W,H)); d=ImageDraw.Draw(c)
    for y in range(H):
        t=y/(H-1); col=tuple(int(top[i]*(1-t)+bot[i]*t) for i in range(3))+(255,)
        d.line([(0,y),(W,y)],fill=col)
    return c
def put(c,p,x,y,h=None,w=None,flip=False,rot=0,shadow=True,pixel=False,anchor='bottom'):
    im=L(p) if isinstance(p,str) else p
    bb=im.getbbox()
    if bb: im=im.crop(bb)
    if flip: im=ImageOps.mirror(im)
    if h: s=h/im.height
    elif w: s=w/im.width
    else: s=1
    im=im.resize((max(1,int(im.width*s)),max(1,int(im.height*s))),Image.NEAREST if pixel else Image.LANCZOS)
    if rot: im=im.rotate(rot,expand=True,resample=Image.BICUBIC)
    px,py=(x-im.width//2, y-im.height) if anchor=='bottom' else (x-im.width//2,y-im.height//2)
    if shadow:
        sh=Image.new('RGBA',im.size,(0,0,0,0)); a=im.split()[3].point(lambda v: int(v*0.28))
        sh.putalpha(a); sh=sh.filter(ImageFilter.GaussianBlur(4))
        blk=Image.new('RGBA',im.size,(0,0,0,255)); blk.putalpha(sh.split()[3])
        c.alpha_composite(blk,(px+4,py+6))
    c.alpha_composite(im,(px,py))
def wash(c,rgba):
    o=Image.new('RGBA',(W,H),rgba); c.alpha_composite(o)
def save(c,name):
    c.convert('RGB').save(OUT+name+'.jpg',quality=86,optimize=True)

PP='Platformer Pack Remastered/'
# 1 Football: kicking hero on bright grass, ball flying
c=bg_tile(PP+'Backgrounds/colored_grass.png')
put(c,A+'heroes/maleAdventurer_kick.png',190,270,h=210)
save(c,'football')
# 2 Wolf vs Sheep (his game): wolf-ish dog and goat on land
c=bg_tile(PP+'Backgrounds/colored_land.png')
put(c,A+'animals/dog.png',170,262,h=150); put(c,A+'animals/goat.png',330,262,h=120)
save(c,'wolf-vs-sheep')
# 3 Magic Square: white dice on a purple night sky with stars
c=bg_tile('Space Shooter Remastered/Backgrounds/purple.png',scale=1.2)
for i,(x,y,n) in enumerate([(170,150,8),(240,150,1),(310,150,6)]):
    pass
dice=['Boardgame Pack/Dice/dieWhite_border2.png','Boardgame Pack/Dice/dieWhite_border5.png','Boardgame Pack/Dice/dieWhite_border3.png']
for i,d in enumerate(dice): put(c,d,160+i*80,230,h=78,rot=[-8,4,10][i])
for (x,y,s) in [(60,60,26),(420,50,30),(390,240,22),(90,230,18)]:
    put(c,'Space Shooter Remastered/Effects/star3.png' if os.path.exists(K+'Space Shooter Remastered/Effects/star3.png') else PP+'Items/star.png',x,y,h=s,shadow=False,anchor='center')
save(c,'magic-square')
# 4 Quick Maths: UFO race in space
c=bg_tile('Space Shooter Remastered/Backgrounds/darkPurple.png',scale=1.2)
put(c,'Alien UFO Pack/laserGreen_burst.png',120,90,h=60,shadow=False,anchor='center')
put(c,'Alien UFO Pack/shipGreen_manned.png',250,200,h=150)
put(c,'Alien UFO Pack/shipPink.png',400,110,h=60)
put(c,'Alien UFO Pack/shipYellow.png',90,250,h=50)
save(c,'qm')

# --- fix football: add ball and a goal-ish feel
c=bg_tile(PP+'Backgrounds/colored_grass.png')
put(c,A+'heroes/maleAdventurer_kick.png',170,272,h=215)
put(c,'Sports Pack/Equipment/ball_soccer1.png',330,170,h=62,rot=20)
save(c,'football')
# magic square: dice + planet
c=bg_tile('Space Shooter Remastered/Backgrounds/purple.png',scale=1.2)
put(c,'Planets/Planets/planet03.png',400,90,h=110,shadow=False,anchor='center')
for i,d in enumerate(dice): put(c,d,130+i*80,240,h=78,rot=[-8,4,10][i])
for (x,y,s) in [(60,60,26),(250,45,20),(300,250,18),(40,230,18)]:
    put(c,PP+'Items/star.png',x,y,h=s,shadow=False,anchor='center')
save(c,'magic-square')
# QM: rockets + planet
c=bg_tile('Space Shooter Remastered/Backgrounds/darkPurple.png',scale=1.2)
put(c,'Planets/Planets/planet07.png',420,250,h=150,shadow=False,anchor='center')
put(c,'Alien UFO Pack/shipGreen_manned.png',220,215,h=150)
put(c,'Alien UFO Pack/shipPink.png',395,95,h=58)
put(c,'Alien UFO Pack/shipYellow.png',80,95,h=46)
for (x,y,s) in [(140,40,16),(330,40,20),(40,200,14)]: put(c,PP+'Items/star.png',x,y,h=s,shadow=False,anchor='center')
save(c,'qm')
# TT: race car on the track, crowd stand
c=grad((120,190,90),(80,150,60))
road=L('Racing Pack/Tiles/Asphalt road/road_asphalt01.png').rotate(90,expand=True).resize((120,120))
for x in range(0,W,120): c.alpha_composite(road,(x,150))
put(c,'Racing Pack/Objects/tribune_full.png',120,120,h=110,rot=0,shadow=True)
put(c,'Racing Pack/Objects/tribune_full.png',360,120,h=110)
put(c,'Racing Pack/Cars/car_red_1.png',260,215,h=150,rot=-90,anchor='center')
put(c,'Racing Pack/Cars/car_blue_1.png',90,235,h=120,rot=-90,anchor='center')
put(c,'Racing Pack/Objects/cone_straight.png',440,290,h=40)
save(c,'tt')
# SD: red dice on green felt
c=grad((46,125,80),(25,85,50))
for i,(x,y,n,r) in enumerate([(190,140,1,-6),(290,140,2,5),(190,240,3,4),(290,240,4,-7)]):
    put(c,f'Boardgame Pack/Dice/dieRed_border{n}.png',x,y,h=88,rot=r,anchor='center')
put(c,'Boardgame Pack/Pieces (Blue)/pieceBlue_border00.png' if os.path.exists(K+'Boardgame Pack/Pieces (Blue)/pieceBlue_border00.png') else 'Boardgame Pack/Dice/dieWhite1.png',410,240,h=90)
save(c,'sd')
# FP: big donut with a slice cut, on a picnic sand
def donut(gl,spr):
    d=L('Donuts/donut_1.png'); d.alpha_composite(L(f'Donuts/{gl}').resize(d.size)); d.alpha_composite(L(f'Donuts/{spr}').resize(d.size)); return d
c=bg_tile(PP+'Backgrounds/colored_desert.png')
put(c,donut('glazing_1.png','sprinkles_2.png'),200,265,h=190)
put(c,donut('glazing_3.png','sprinkles_1.png'),370,275,h=110)
save(c,'fp')
# FF: two robots face off
c=bg_tile(PP+'Backgrounds/blue_land.png')
put(c,'Robot Pack/Side view/robot_redJump.png',130,265,h=150)
put(c,'Robot Pack/Side view/robot_blueBody.png',350,268,h=150,flip=True)
save(c,'ff')
# FC: pirate ship sharing treasure at sea
c=grad((120,200,240),(40,120,200))
put(c,'Pirate Pack/Ships/ship (3).png',190,150,h=240,rot=-90,anchor='center')
for i,(x,y) in enumerate([(360,240),(395,250),(430,238),(380,210),(415,215)]):
    put(c,PP+'Items/coinGold.png',x,y,h=46,anchor='center')
save(c,'fc')
# CK: owl on a shroom land with a big clock tower
c=bg_tile(PP+'Backgrounds/colored_shroom.png')
put(c,A+'scene/towerSmall.png',380,265,h=200)
put(c,A+'animals/owl.png',180,262,h=170)
save(c,'ck')

BP='Block Pack/Retina/'
# MS: market stall + coins + shopper
c=bg_tile(PP+'Backgrounds/blue_desert.png')
put(c,BP+'market_stallBlue.png',150,272,h=190)
put(c,BP+'character_woman.png',275,272,h=120)
for (x,y) in [(370,272),(410,272),(450,272),(390,232),(430,232),(410,192)]: put(c,PP+'Items/coinGold.png',x,y,h=42)
save(c,'ms')
# LS: my little shop: red market stall, cart, shopkeeper
c=bg_tile(PP+'Backgrounds/colored_land.png')
put(c,BP+'market_stallRed.png',150,272,h=200)
put(c,BP+'character_man.png',270,272,h=120)
put(c,BP+'cart.png',390,272,h=110)
put(c,BP+'foliageTree_green.png',455,272,h=150)
save(c,'ls')
# PB: pig with coins raining
c=bg_tile(PP+'Backgrounds/blue_grass.png')
put(c,A+'animals/pig.png',240,272,h=170)
for (x,y,n,r) in [(90,70,'Gold',-15),(170,40,'Silver',10),(330,55,'Bronze',20),(410,100,'Gold',-5),(70,170,'Silver',0)]:
    put(c,PP+f'Items/coin{n}.png',x,y,h=46,rot=r,anchor='center')
save(c,'pb')
# SB: voxel blocks building
c=bg_tile(PP+'Backgrounds/blue_shroom.png')
blocks=[('tileGrass.png',140,290),('tileStone.png',212,290),('tileWood.png',284,290),('tileSand.png',176,232),('tileSnow.png',248,232),('tileGrass.png',212,174)]
for f,x,y in blocks: put(c,BP+f,x,y,h=82,shadow=False)
put(c,A+'animals/bear.png',400,285,h=110)
save(c,'sb')
# BP: physics aliens on a plank seesaw
c=bg_tile(PP+'Backgrounds/colored_desert.png')
d=ImageDraw.Draw(c)
d.polygon([(240,250),(210,290),(270,290)],fill=(150,110,60,255))
d.rounded_rectangle([60,236,420,252],radius=8,fill=(190,140,80,255),outline=(120,80,40,255),width=3)
put(c,'Physics Assets/Aliens/alienPink_round.png',120,238,h=80)
put(c,'Physics Assets/Aliens/alienBlue_square.png',200,238,h=60)
put(c,'Physics Assets/Aliens/alienYellow_suit.png',350,238,h=95)
save(c,'bp')
# PL: pixel art world (pixel tiles scaled up)
c=bg_tile(PP+'Backgrounds/blue_land.png')
T='Pixel Platformer/Tiles/'
for i in range(0,W,54): put(c,T+'tile_0022.png',i+27,H,h=54,pixel=True,shadow=False)
put(c,T+'Characters/tile_0000.png',150,H-54,h=110,pixel=True)
put(c,T+'tile_0044.png',300,140,h=60,pixel=True,anchor='center',shadow=False)
put(c,T+'tile_0067.png',360,120,h=50,pixel=True,anchor='center',shadow=False)
put(c,T+'tile_0010.png',250,150,h=54,pixel=True,anchor='center',shadow=False)
save(c,'pl')
# MN: playing cards fanned on felt + chips
c=grad((30,110,70),(15,70,45))
for i,(card,r) in enumerate([('cardHearts6.png',14),('cardSpades4.png',0),('cardDiamonds2.png',-14)]):
    put(c,'Boardgame Pack/Cards/'+card,190+i*55,265,h=190,rot=r)
put(c,'Boardgame Pack/Chips/chipRedWhite.png',420,270,h=60)
put(c,'Boardgame Pack/Chips/chipBlueWhite.png',60,280,h=50)
save(c,'mn')
# NS: worm/snake on grass with a path of gems
c=bg_tile(PP+'Backgrounds/colored_grass.png')
for i,(x,y,g) in enumerate([(80,250,'Blue'),(150,230,'Green'),(220,250,'Yellow'),(290,230,'Red')]):
    put(c,PP+f'Items/gem{g}.png',x,y,h=46,anchor='center')
put(c,A+'animals/snake.png',390,268,h=150)
save(c,'ns')
# Bridge & torch: night, wooden bridge, runners, fire
c=bg_tile(PP+'Backgrounds/blue_land.png')
wash(c,(16,28,70,170))
d=ImageDraw.Draw(c)
d.rectangle([0,250,W,H],fill=(40,90,170,255))
for x in range(40,440,40): d.rectangle([x,200,x+34,214],fill=(150,100,50,255))
d.rectangle([40,196,440,200],fill=(110,70,30,255))
put(c,A+'heroes/maleAdventurer_run0.png',150,204,h=120)
put(c,A+'heroes/femalePerson_run0.png',330,204,h=110)
put(c,'Pirate Pack/Effects/fire1.png',205,120,h=50,shadow=False,anchor='center')
save(c,'bridge-torch')
# CQ: hero vs clock monster at the castle
c=bg_tile(A+'bg/castles.png')
wash(c,(28,18,56,150))
put(c,A+'heroes/femaleAdventurer_attack1.png',150,275,h=190)
put(c,A+'monsters/clockmonster.png',350,275,h=180,flip=True)
save(c,'cq')
