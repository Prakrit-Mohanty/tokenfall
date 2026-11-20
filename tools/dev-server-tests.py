"""Self-test for the dev server's page stamp. Run: python3 tools/dev-server-tests.py (pytest also collects the test_ functions)."""
import importlib.util
import os
from types import ModuleType


def load_dev_server() -> ModuleType:
    spec = importlib.util.spec_from_file_location('dev_server', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dev-server.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


dev = load_dev_server()


def test_puts_the_server_start_id_right_after_head() -> None:
    out = dev.with_boot('<!doctype html><html><head><title>x</title></head></html>', 'abc')
    assert '<head><meta name="tokenfall-server-boot" content="abc"><title>' in out


def test_head_with_attributes_and_capitals_still_gets_the_stamp() -> None:
    out = dev.with_boot('<HTML><Head lang="en">\n<title>x</title>', 'abc')
    assert '<Head lang="en"><meta name="tokenfall-server-boot" content="abc">' in out


def test_a_page_without_head_is_left_alone() -> None:
    assert dev.with_boot('<p>no head</p>', 'abc') == '<p>no head</p>'


def test_only_the_first_head_is_stamped() -> None:
    assert dev.with_boot('<head></head><head></head>', 'x').count('tokenfall-server-boot') == 1


def test_only_the_game_page_is_stamped() -> None:
    for path in ['/', '/index.html', '/?intro', '/index.html?zone=lobby']:
        assert dev.is_game_page(path), path
    for path in ['/js/game/ui.js', '/design-mocks/index.html', '/gaurav-npc/index.html', '/css/game.css']:
        assert not dev.is_game_page(path), path


def test_the_server_queues_a_whole_page_load_of_connections() -> None:
    assert dev.DevServer.request_queue_size >= 128, 'a page load opens ~100 connections at once; a short queue resets them'


def test_each_server_start_gets_a_new_id() -> None:
    assert dev.new_boot_id() != dev.new_boot_id()


if __name__ == '__main__':
    tests = [f for name, f in sorted(globals().items()) if name.startswith('test_') and callable(f)]
    for t in tests:
        t()
        print('ok', t.__name__)
    print(f'\n{len(tests)} checks passed')
