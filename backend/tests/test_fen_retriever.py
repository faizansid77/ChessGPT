import pytest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fen_retriever import convert_fen_to_dotted_pieces

def test_convert_fen_to_dotted_pieces_standard():
    fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    expected_dotted = "rnbqkbnr/pppppppp/......../......../......../......../PPPPPPPP/RNBQKBNR"
    assert convert_fen_to_dotted_pieces(fen) == expected_dotted

def test_convert_fen_to_dotted_pieces_with_numbers():
    fen = "r1b1k1nr/p2p1p1p/n5N1/1p1P4/2p3P1/P1P1P3/2P1BP1P/R3K2R b KQkq - 0 22"
    expected_dotted = "r.b.k.nr/p..p.p.p/n.....N./.p.P..../..p...P./P.P.P.../..P.BP.P/R...K..R"
    assert convert_fen_to_dotted_pieces(fen) == expected_dotted

def test_convert_fen_to_dotted_pieces_empty_fen():
    fen = "8/8/8/8/8/8/8/8 w - - 0 1"
    expected_dotted = "......../......../......../......../......../......../......../........"
    assert convert_fen_to_dotted_pieces(fen) == expected_dotted
